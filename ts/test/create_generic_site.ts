import {Lithograph} from "lithograph";
import {defaultTestPort, defaultTestSiteDirectory} from "test/test_utils";
import {promises as Fs} from "fs";
import * as SASS from "sass";

function getHashAppendixIfPossible(urlPath: string, context: Lithograph.RenderContext<unknown>): string {
	if(!context.hasHashes || !context.isRelativeUrl(urlPath)){
		return "";
	}

	return "?h=" + context.getHashOrThrow(urlPath).substr(0, 8)
}

function addSassBase(contentSet: Lithograph.ContentSet<unknown>): void {
	contentSet.addSassSource(defaultTestSiteDirectory + "/css/");
	contentSet.addSassFunction("darkMode", () => SASS.types.Boolean.TRUE);
	contentSet.addSassFunction("appendHash($url)", function(url: SASS.types.SassType){
		if(!(url instanceof SASS.types.String)){
			throw new Error("String expected as url, got " + url);
		}
		let urlStr = url.getValue();
		let fullUrl = urlStr + getHashAppendixIfPossible(urlStr, this)
		return new SASS.types.String(fullUrl);
	});
}

export async function createGenericSite(): Promise<Lithograph.ContentSet> {
	let contentSet = Lithograph.createContentSet({
		defaultPageParams: {},
		domain: "localhost",
		preferredProtocol: "http",
		port: defaultTestPort,
		rootDirectoryPath: defaultTestSiteDirectory + "/root",
		minifyCss: true,
		minifyHtml: true,
		useSitemap: true,
		validateHtml: true
	});

	let h2 = contentSet.addWidgetWithOptionalParams<{class?: string}>((_, params, body) => {
		return `<h2${params && params.class? ` class="${params.class}"`: ""}>${body}</h2>`
	});

	let pageLink = contentSet.addWidgetWithParams<{ src: string, content: string }>((context, opts) => {
		if(context.isRelativeUrl(opts.src) && !context.urlPointsToPage(opts.src)){
			throw new Error(`Expected url path ${opts.src} to point to page, but it's not.`);
		}
		return `<a href="${opts.src}">${opts.content}</a>`
	})

	let cssFileLink = contentSet.addWidgetWithoutParams((context, url) => {
		if(context.isRelativeUrl(url) && !context.urlPointsToCssFile(url)){
			throw new Error(`Expected ${url} to point to CSS file, but it's not.`)
		}
		return `<link rel="stylesheet" href="${url}${getHashAppendixIfPossible(url,context)}">`
	});

	let pageTitle = contentSet.addWidgetWithoutParams((_, body) => `<title>${body}</title>`);

	let jsFileLink = contentSet.addWidgetWithoutParams((context, url) => {
		if(context.isRelativeUrl(url) && !context.urlPointsToJsFile(url)){
			throw new Error(`Expected ${url} to point to JS file, but it's not.`)
		}
		return `<script src="${url}${getHashAppendixIfPossible(url,context)}" async></script>`;
	});

	let image = contentSet.addWidgetWithParams<{ src: string, alt: string }>((context, opts) => {
		if(!context.urlPointsToImage(opts.src)){
			throw new Error(`Expected url path ${opts.src} to point to image, but it's not.`);
		}

		let webpPart = "";
		if(context.hasWebp && context.isRelativeUrl(opts.src)){
			let webpPath = context.getImageWebpUrlPath(opts.src);
			webpPart = `<source type="image/webp" srcset="${webpPath}${getHashAppendixIfPossible(webpPath, context)}">`
		}

		let imageInfo = context.getImageInfo(opts.src);
		
		return `<picture data-width="${imageInfo.width}" data-height="${imageInfo.height}">
			${webpPart}
			<img alt="${context.escapeAttribute(opts.alt)}" src="${opts.src}${getHashAppendixIfPossible(opts.src, context)}">
		</picture>`
	});

	let page = contentSet.addWidgetWithParams<{ head: string, body: string }>((_, opts) => {
		return `<!DOCTYPE html>
		<html>
			<head>
				${opts.head}
			</head>
			<body>
				${opts.body}
			</body>
		</html>`
	});

	await contentSet.doneWithWidgets();

	contentSet.addSassItem("/main.css", defaultTestSiteDirectory + "/css/main.scss");
	addSassBase(contentSet);

	contentSet.setImageDirectory(defaultTestSiteDirectory + "/root/img");
	contentSet.setWebpDirectory(defaultTestSiteDirectory + "/root/webp");

	contentSet.addImploderProject("/main.js", defaultTestSiteDirectory + "/front_ts/tsconfig.json");
	// should not interfere with anything
	contentSet.addExternalJsDirectory(defaultTestSiteDirectory + "/root");
	
	contentSet.addResourceDirectory(defaultTestSiteDirectory + "/root/font/");

	await contentSet.doneWithResources();



	function typicalPage(title: string, body: string): string {
		return page({
			head: [
				pageTitle(title),
				cssFileLink("/main.css"),
				jsFileLink("/main.js")
			].join("\n"),
			body
		})
	}

	let mainPage = contentSet.addStaticPage({
		urlPath: "/",
		render: () => typicalPage("Main page!", [
			h2("I am main page!"),
			pageLink({content: "this is google!", src: "https://google.com"}),
			image({src: "/img/cat_image.png", alt: "oh look a cat"}),
			valueLists.animal.map(x => pageLink({content: "to page about " + x, src: "/animal/" + x})).join("<br/>")
		].join("\n"))
	});

	let valueLists = {
		animal: ["cat", "dog", "hamster"]
	};

	let animalMatcher = contentSet.createPathPatternMatcher({
		valueLists, pathPattern: ["/animal/", {name: "animal"}]
	});

	contentSet.addUrlDefinedDynamicPage({
		matcher: animalMatcher,
		renderToFiles: true,
		render: context => {
			let {animal} = animalMatcher.matchOrThrow(context.urlPath);
			return typicalPage("Page about " + animal, [
				h2("This is the page about glorious " + animal + "!"),
				h2({class: "subtext"}, "This is subtext!"),
				pageLink({ content: "Home", src: "../root"}),
				pageLink({ content: "CATZ", src: "./cat"})
			].join("\n"));
		}
	});	
	

	contentSet.setFileNotFoundPage({
		generateFile: true,
		includeInSitemap: true,
		urlPath: "/errors/404",
		render: context => typicalPage("404 T___T", [
			h2("Nothing is present for path " + context.urlPath)
		].join("\n"))
	});

	contentSet.setServerErrorPage({
		generateFile: true,
		urlPath: "/errors/500",
		render: () => typicalPage("500 o_o", [
			h2("Uh oh, we're in trouble. Something just died.")
		].join("\n")) 
	})

	contentSet.setPageRouter(urlPath => {
		switch(urlPath){
			case "/about": return {permanentRedirect: "/"}
			case "/give_me_error": throw new Error("Whoopsie!");
			case "/root": return {page: mainPage}
			default: return {notFound: true}
		}
	})

	await contentSet.doneWithPages();
	
	return contentSet;
}


export async function createGenericSiteWithBrokenCssJs(params?: {jsNotBroken?: boolean, cssNotBroken?: boolean}, opts?: Partial<Lithograph.ContentSetCommonOptions<Record<string, never>>>): Promise<Lithograph.ContentSet>{
	let contentSet = Lithograph.createContentSet({
		defaultPageParams: {},
		domain: "localhost",
		preferredProtocol: "http",
		port: defaultTestPort,
		rootDirectoryPath: defaultTestSiteDirectory + "/root",
		...(opts || {})
	});

	await contentSet.doneWithWidgets();

	contentSet.addImploderProject("/main.js", defaultTestSiteDirectory + "/front_ts/tsconfig.json");
	if(!params?.jsNotBroken){
		await Fs.writeFile(defaultTestSiteDirectory + "/front_ts/main.ts", "THIS IS NOT VALID CODE!", "utf-8");
	}

	addSassBase(contentSet);
	if(!params?.cssNotBroken){
		contentSet.addSassItem("/main.css", defaultTestSiteDirectory + "/css/broken_code.scss");
	}

	await contentSet.doneWithResources();
	await contentSet.doneWithPages();

	return contentSet;
}