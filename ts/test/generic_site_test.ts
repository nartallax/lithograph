import {getFileListRecursive} from "lithograph_utils";
import {createGenericSite, createGenericSiteWithBrokenCssJs} from "test/create_generic_site";
import {defaultTestPort, defaultTestSiteDirectory, httpGet, httpGetStr, testWithSite} from "test/test_utils";
import {promises as Fs} from "fs";
import * as Path from "path";
import {Lithograph} from "lithograph";


testWithSite("generic site http", async assert => {

	let contentSet = await createGenericSite();
	await contentSet.startHttpServer({port: defaultTestPort, host: "localhost"});

	try {
		let mainPageHtml = await httpGetStr("/");
		assert(mainPageHtml).contains("<br>"); // minification works - original has <br/> 
		assert(mainPageHtml).contains("<title>Main page!</title>");
		assert(mainPageHtml).contains("to page about cat");
		assert(mainPageHtml).contains('"/animal/cat"');
		assert(mainPageHtml).contains("\"/img/cat_image.png?h=780194a9\"");
		assert(mainPageHtml).contains("\"/main.css?h=9f842327\"");
		assert(mainPageHtml).contains("\"/main.js?h=2c2d736c\"");

		let catPageHtml = await httpGetStr("/animal/cat");
		assert(catPageHtml).contains("<title>Page about cat</title>");
		assert(catPageHtml).contains('href="../root"');
		assert(catPageHtml).contains('href="./cat"');

		let possumPage = await httpGet("/animal/possum");
		assert(possumPage.body.toString("utf-8")).contains("<h2>Nothing is present for path /animal/possum</h2>");
		assert(possumPage.code).equalsTo(404);

		let errPage = await httpGet("/give_me_error");
		assert(errPage.body.toString("utf-8")).contains("Something just died");
		assert(errPage.code).equalsTo(500);

		let pageWithLastSlash = await httpGet("/animal/cat/");
		assert(pageWithLastSlash.code).equalsTo(404);

		let redirectPage = await httpGet("/about");
		assert(redirectPage.headers.location).equalsTo("/")
		assert(redirectPage.code).equalsTo(301);

		let sitemap = await httpGetStr("/sitemap.xml");
		assert(sitemap).contains("<loc>http://localhost:8085/animal/cat</loc>");
		assert(sitemap).contains("<loc>http://localhost:8085/errors/404</loc>");
		assert(sitemap).notContains("<loc>http://localhost:8085/errors/500</loc>");

		let errPageAsNormalPage = await httpGet("/errors/404");
		assert(errPageAsNormalPage.code).equalsTo(200);

		let mainAsRootPage = await httpGet("/root");
		assert(mainAsRootPage.body.toString("utf-8")).contains("<title>Main page!</title>")
		assert(mainAsRootPage.code).equalsTo(200);

		assert((await httpGet("/img/cat_image.png")).code).equalsTo(200);
		assert((await httpGet("/webp/cat_image.png.webp")).code).equalsTo(200);

		// case matters
		assert((await httpGet("/ROOT")).code).equalsTo(404)
		assert((await httpGet("/ANIMAL/CAT")).code).equalsTo(404);
		assert((await httpGet("/font/Lato.ttf")).code).equalsTo(200);

		let cssResp = await httpGet("/main.css?h=THIS_IS_NOT_CORRECT_HASH!");
		assert(cssResp.code).equalsTo(200);
		assert(cssResp.body.toString("utf-8")).contains(".gallery{display");
		assert(cssResp.body.toString("utf-8")).contains("src:url(/font/Lato.ttf?h=79164ee5)");
		assert(cssResp.headers["content-type"]).equalsTo("text/css");
	} finally {
		await contentSet.stopHttpServer();
	}

})

testWithSite("generic site files", async assert => {
	let contentSet = await createGenericSite();
	await contentSet.writeAllToDisk();

	let rootDirPath = defaultTestSiteDirectory + "/root";
	let fileList = (await getFileListRecursive(rootDirPath))
		.map(x => x.substr(rootDirPath.length))
		.map(x => x.replace(/\\/g, "/"))
		.sort();

	assert(fileList).equalsTo([
		'/animal/cat.html',
		'/animal/dog.html',
		'/animal/hamster.html',
		'/errors/404.html',
		'/errors/500.html',
		'/font/Lato.ttf',
		'/img/cat_image.png',
		'/index.html',
		'/main.css',
		'/main.js',
		'/sitemap.xml',
		'/webp/README.md',
		'/webp/cat_image.png.webp'
	]);

	assert(await Fs.readFile(Path.resolve(rootDirPath, "index.html"), "utf8")).contains("<title>Main page!</title>");
	assert(await Fs.readFile(Path.resolve(rootDirPath, "animal/cat.html"), "utf8")).contains("<title>Page about cat</title>");

	void assert;
});

testWithSite("generic site with bad css + js", async assert => {
	await assert(createGenericSiteWithBrokenCssJs({jsNotBroken: true})).throws(/expected "{"/);
	await assert(createGenericSiteWithBrokenCssJs({cssNotBroken: true})).throws(/^Failed to build Imploder project /);
});

testWithSite("generic site without hashes with bad css + js", async assert => {
	let contentSet = await createGenericSiteWithBrokenCssJs({}, {noHashes: true});
	await contentSet.startHttpServer({port: defaultTestPort, host: "localhost"});

	let jsResp = await httpGet("/main.js");
	assert(jsResp.code).equalsTo(500);
	assert(jsResp.headers["content-type"]).equalsTo("text/html");
	assert(jsResp.body.toString("utf-8")).contains("<h1>")

	let cssResp = await httpGet("/main.css");
	assert(cssResp.code).equalsTo(500);
	assert(cssResp.headers["content-type"]).equalsTo("text/html");
	assert(cssResp.body.toString("utf-8")).contains("<h1>");

	let sitemapResp = await httpGet("/sitemap.xml");
	assert(sitemapResp.code).equalsTo(404);

	await contentSet.stopHttpServer();
});

testWithSite("bad input urlpaths", async assert => {
	let contentSet = Lithograph.createContentSet({
		domain: "localhost",
		preferredProtocol: "http",
		port: defaultTestPort,
		rootDirectoryPath: defaultTestSiteDirectory + "/root"
	});

	await contentSet.doneWithWidgets();

	assert(() => contentSet.addSassItem("main.css", "/tmp/main.scss"))
		.throws("Absolute url path was expected here, but got main.css")

	assert(() => contentSet.addSassItem("/main.css/", "/tmp/main.scss"))
		.throws("File url path was expected here, but got /main.css/")
})

testWithSite("css validation", async assert => {

	let contentSet = Lithograph.createContentSet({
		domain: "localhost",
		preferredProtocol: "http",
		port: defaultTestPort,
		rootDirectoryPath: defaultTestSiteDirectory + "/root"
	});

	await contentSet.doneWithWidgets();

	contentSet.addSassItem("/main.css", defaultTestSiteDirectory + "/css/broken_code.scss");
	await assert(contentSet.doneWithResources()).throws(/expected "{"/);
})


testWithSite("html validation", async assert => {

	let contentSet = Lithograph.createContentSet({
		domain: "localhost",
		preferredProtocol: "http",
		port: defaultTestPort,
		rootDirectoryPath: defaultTestSiteDirectory + "/root",
		validateHtml: true
	});

	await contentSet.doneWithWidgets();
	await contentSet.doneWithResources();

	contentSet.addStaticPage({
		urlPath: "/root",
		render: () => "<h1 THIS IS NOT VALID HTML"
	});

	await contentSet.doneWithPages();
	await assert(contentSet.writeAllToDisk()).throws(/Parse Error/);
})

testWithSite("test dynamic writes are disableable", async () => {

	let contentSet = Lithograph.createContentSet({
		domain: "localhost",
		preferredProtocol: "http",
		port: defaultTestPort,
		rootDirectoryPath: defaultTestSiteDirectory + "/root",
		noDynamicGenerationTests: true
	});

	await contentSet.doneWithWidgets();
	await contentSet.doneWithResources();

	contentSet.addUrlDefinedDynamicPage({
		valueLists: {},
		pathPattern: ["/test"],
		render: () => {throw new Error("NOPE")}
	});

	await contentSet.doneWithPages();
	await contentSet.writeAllToDisk();
})