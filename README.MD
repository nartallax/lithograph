
# Lithograph

A tool that helps create static and almost-static websites.  
Lithograph is aimed for some specific development techniques; that is, not everything about website buildingcould be done with this tool, and that's intentional.  
Lithograph it also aimed for fast start, as it expects to be restarted frequently when developing. See below for usage cases.  

## Install

	npm install --save typescript
	npm install --save tslib
	npm install --save @nartallax/imploder
	npm install --save @nartallax/lithograph

## Use

Some use-cases are defined in tests [like this one](ts/test/create_generic_site.ts).  
Step-by-step process of site definition is following:  

### 1. Create content set  

Content set is basically the definition of the site as a whole.  

	import {Lithograph} from "@nartallax/lithograph";

	let contentSet = Lithograph.createContentSet({
		domain: "localhost",
		preferredProtocol: "http",
		rootDirectoryPath: "./site_content/root",
		minifyCss: true,
		minifyHtml: true,
		useSitemap: true,
		validateCss: true,
		validateHtml: true
	});

### 2. Add widgets to content set

Widgets are building blocks of HTML pages.  
Widget is render function that gets render context and options on input, and gives HTML as result.  
Render context contains some useful functions to query information about site structure, as well as contains information about currently rendered page and content set settings. You should use information about site structure to early-check for errors.  

	let pageLink = contentSet.addWidget<{ src: string, content: string }>((context, opts) => {
		if(context.isRelativeUrl(opts.src) && !context.urlPointsToPage(opts.src)){
			throw new Error(`Expected url path ${opts.src} to point to page, but it's not.`);
		}
		return `<a href="${opts.src}">${opts.content}</a>`
	});

Here we define a widget that is anchor html element pointing to another page. Notice that we check for link correctness, so broken links could not be passed.  
After all widgets are defined, we must explicitly advance to next stage.

	await contentSet.doneWithWidgets();

### 3. Add resources to content set

Resources are something that pages could refer to: images, css, js, fonts...  

#### CSS

CSS files are assembled with SASS.  
To do so, you need to point Lithograph to entrypoint file and maybe add some directories to search other SASS source files in:

	contentSet.addSassItem("/main.css", "./site_content/css/main.scss");
	contentSet.addSassSource("./site_content/css/");

You can also define functions that will be callable from inside SASS code:

	contentSet.addSassFunction("appendHash($url)", function(url: SASS.types.SassType){
		if(!(url instanceof SASS.types.String)){
			throw new Error("String expected as url, got " + url);
		}
		let urlStr = url.getValue();
		let fullUrl = urlStr + getHashQueryParams(urlStr, this)
		return new SASS.types.String(fullUrl);
	});

Note that functions receive `RenderContext` as `this`.  
After that you can call the function:

	src: url(appendHash('/font/Lato.ttf')) format("truetype");

#### JS

Preferred way of JS definition is to create separate [Imploder](https://github.com/nartallax/imploder "Imploder") project and point content set to it:  

	contentSet.addImploderProject("/main.js", "./site_content/front_ts/tsconfig.json", "development");

Note that Lithograph is able to detect if selected Imploder profile has watchmode enabled. If so, Lithograph will send HTTP requests to Imploder instance it assemes running. It was mainly intended to use with [Koramund](https://github.com/nartallax/koramund), but you can just launch an Imploder instance separately.  
Other way to add JS file is addExternalJsDirectory() and addExternalJsFile() methods. External JS is provided as-is.  

#### Images

Images are expected to reside in single directory you can point content set to. This directory should reside inside site root directory.

	contentSet.setImageDirectory("./site_content/root/img");

Lithograph could also convert images to webp format automatically. Webp pictures are more lightweight, and some of search-robots are favoring webp over other image formats.  

	contentSet.setWebpDirectory("./site_content/root/webp");

If webp directory is defined, you can use webps like this (this is widget definition):

	let image = contentSet.addWidget<{ src: string, alt: string }>((context, opts) => {
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

#### Other files

If you want to supply just any files, you can include them with addResourceDirectory() or addResourceFile():  

	contentSet.addResourceDirectory("./site_content/root/font/");

After all resources are defined, we must explicitly advance to next stage.

	await contentSet.doneWithResources();

### 4. Add pages to content set

There are several ways you can do this.
Static pages are pages that have one single url without any routing magic attached:  

	let mainPage = contentSet.addStaticPage({
		urlPath: "/",
		render: () => "<html><body>I am main page!</body></html>"
	});

URL-defined dynamic pages are pages urls of which are conforming to some pattern; it is expected for you to extract parameters from the url:

	let valueLists = {
		animal: ["cat", "dog", "hamster"]
	};

	let animalMatcher = contentSet.createPathPatternMatcher({
		valueLists, pathPattern: ["/animal/", {name: "animal"}]
	});

	contentSet.addUrlDefinedDynamicPage({
		matcher: animalMatcher,
		render: context => {
			let {animal} = animalMatcher.matchOrThrow(context.urlPath);
			return `<html><body>
				This is page about ${animal}!
				${pageLink({src: "/", content: "back to main page"})}
			</body></html>`
		}
	});

Note that you can use wigdets in page render function as in example below. You don't need to pass context to them, just options.

And you can define pages based on arbitrary rules that does not conform to just that with addPage().  
You can implement these arbitrary rules with routing handler:  

	contentSet.setPageRouter(urlPath => {
		switch(urlPath){
			case "/about": return {permanentRedirect: "/"}
			case "/give_me_error": throw new Error("Whoopsie!");
			case "/root": return {page: mainPage}
			default: return {notFound: true}
		}
	});

Routing handler is invoked when nothing else is found. That is, in previous example urlPath will never be "/animal/cat", as there is page that corresponds to the path.  
You can also define pages that are shown in case of errors:

	contentSet.setFileNotFoundPage({
		render: context => typicalPage("404 T___T", [
			h2({text: "Nothing is present for path " + context.urlPath })
		].join("\n"))
	});

	contentSet.setServerErrorPage({
		render: () => typicalPage("500 o_o", [
			h2({text: "Uh oh, we're in trouble. Something just died." })
		].join("\n")) 
	});

After all pages are defined, you should explicitly finish the page definition stage:  

	await contentSet.doneWithPages();

### 5. Run the content set

At this point your content set definition is complete. Now you should do something with all this content.  
Most obvious way to do so is start an HTTP server:

	await contentSet.startHttpServer({port: 8085, host: "localhost"});

And it will make the content available at [http://localhost:8085](http://localhost:8085).  

Other way to use the content is to write it all to disk:  

	await contentSet.writeAllToDisk();

This action will create html files out of all pages defined that require it, will create css and js files and so on.  
Use case of writing everything to disk is mostly to supply site content to some other webserver (like nginx) so it could efficiently manage it.  
Note that there are some categories of pages that won't produce files by default - it is dynamic pages and error pages. You can override this on page definition. Also custom routing won't affect files produced in any way.  
That means if you want your smart routing to work and dynamic pages to be shown you should still start Lithograph as HTTP server and configure nginx to use it as fallback when no file is found.  

And other way is to implement some custom logic around content set. To do so, you have describeContentItem() method which will supply you with content item descriptions for url path you pass. This method also invokes routing handler.  

### Notes on some content set options

I won't describe all of options of Lithograph.createContentSet() function here, but some of them are special and/or unobvious and therefore deserve a note here.

#### noHashes

By default Lithograph calculates hashes of all static resources. This can be used to help caching - for instance, you can add hash as URL query-string parameter and return very big caching time; so when file actually changes, URL will change and old cache won't affect new content.  
With noHashes option you can disable this behaviour. This will lead not only to not-calculating hashes, but also will prevent Lithograph from building Imploder projects and CSS files just after resource definition stage, as there will be no need to do so. It could dramatically speed up development if there is many several Imploder projects.  

#### useSitemap

Lithograph could generate sitemap.xml for you.  
Only pages are included in sitemap. By default, dynamic and static pages are included, and error pages are not. This is tweakable via page definition flags.  

#### noDynamicGenerationTests

By default Lithograph tries to generate each dynamic page at least once when writing to disk if no file is created. It is done to catch generation errors early.  
For some reason you may not want this; so there is a flag to disable this behaviour.  

## Naming

Lithos - "stone"; graphein - "write"; so, Lithograph is something that writes in something as static and stable as stone.  
