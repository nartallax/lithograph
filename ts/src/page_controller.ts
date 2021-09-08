import {allKnownMimeTypes} from "mime";
import {Lithograph} from "lithograph";
import {LithographPathController} from "path_controller";
import {UrlPathPatternMatcher} from "url_path_patter_matcher";
import * as HtmlMinifier from "html-minifier";
import {LithographContentController} from "content_controller";
import {writeFileAndCreateDirs} from "lithograph_utils";

export interface LithographPageControllerOptions<PageParams> {
	minify: () => boolean;
	validate: () => boolean;
	doDynamicGenerationTests: () => boolean;
	pathController: LithographPathController;
	doWithContext<T>(urlPath: string, pageParams: Partial<PageParams> | undefined, handler: (context: Lithograph.RenderContext<PageParams>) => T): T;
}


export class LithographPageController<PageParams> implements LithographContentController {

	private readonly allPages: Lithograph.PageDefinition<PageParams>[] = [];
	private readonly staticallyRoutedPages = new Map<string, Lithograph.PageDefinition<PageParams>>();
	private readonly dynamicallyRoutedPages: Lithograph.PageDefinition<PageParams>[] = [];
	private fileNotFoundPage: Lithograph.PageDefinition<PageParams> | null = null;
	private serverErrorPage: Lithograph.PageDefinition<PageParams> | null = null;

	constructor(private readonly opts: LithographPageControllerOptions<PageParams>){}

	addStaticPage(staticDef: Lithograph.StaticPageDefinition<PageParams>): Lithograph.PageDefinition<PageParams> {
		staticDef.includeInSitemap = staticDef.includeInSitemap !== false;
		staticDef.generateFile = staticDef.generateFile !== false;

		return this.addGenericPage({
			params: staticDef.params,
			render: staticDef.render,
			getUrlPathsForSitemap: function*(){
				if(staticDef.includeInSitemap){
					yield staticDef.urlPath;
				}
			},
			getUrlPathsOfFilesToWrite: function*(){
				if(staticDef.generateFile){
					yield staticDef.urlPath;
				}
			},
			generationTestUrlPath: staticDef.urlPath,
			staticUrlPath: staticDef.urlPath,
			neverMinify: !!staticDef.neverMinify,
			neverValidate: !!staticDef.neverValidate
		});

	}

	addPlaintextPage(def: Lithograph.StaticPageDefinition<PageParams>): Lithograph.PageDefinition<PageParams> {
		def.includeInSitemap = !!def.includeInSitemap;
		def.generateFile = def.generateFile !== false;
		def.neverMinify = def.neverMinify !== false;
		def.neverValidate = def.neverValidate !== false;
		
		return this.addStaticPage(def);
	}

	addUrlDefinedDynamicPage<K extends {[k: string]: string[]}>(dynamicDef: Lithograph.UrlDefinedDynamicPageDefinition<K, PageParams>): Lithograph.PageDefinition<PageParams> {

		let matcher: Lithograph.UrlPathPatternMatcher<K>;

		if(isRawUrlDefinedDynamicPageDefinition(dynamicDef)){
			matcher = new UrlPathPatternMatcher(dynamicDef)
		} else {
			matcher = dynamicDef.matcher;
		}

		let iteratorFirstResult = matcher[Symbol.iterator]().next();
		if(iteratorFirstResult.done){
			throw new Error("Pattern is completely incorrect and won't match any url path.");
		}
		let anyUrlPath = iteratorFirstResult.value;

		let emptyGenerator = function*(){
			// intended nothing
		}

		let pageDef: Lithograph.PageDefinition<PageParams> = {
			params: dynamicDef.params,
			getUrlPathsForSitemap: dynamicDef.excludeFromSitemap? emptyGenerator: () => matcher,
			getUrlPathsOfFilesToWrite: dynamicDef.renderToFiles? () => matcher: emptyGenerator,
			matchesUrlPath: urlPath => !!matcher.match(urlPath),
			render: context => dynamicDef.render(context),
			generationTestUrlPath: anyUrlPath
		}

		return this.addGenericPage(pageDef);
	}

	addGenericPage(def: Lithograph.PageDefinition<PageParams>): Lithograph.PageDefinition<PageParams> {
		if(def.staticUrlPath){
			this.opts.pathController.checkUrlPathIsAbsolute(def.staticUrlPath);
		}

		if(def.generationTestUrlPath){
			this.opts.pathController.checkUrlPathIsAbsolute(def.generationTestUrlPath);
		}

		this.allPages.push(def);
		if(def.staticUrlPath){
			this.staticallyRoutedPages.set(def.staticUrlPath, def);		
		}

		if(def.matchesUrlPath){
			this.dynamicallyRoutedPages.push(def);
		}
		return def;
	}


	hasContentItem(urlPath: string): boolean {
		let descr = this.describeContentItem(urlPath);
		return !!descr && descr.responseType === "ok";
	}

	private genericPageDefFromAuxPageDef(page: Lithograph.AuxiliaryPageDefinition<PageParams>): Lithograph.PageDefinition<PageParams> {
		if((page.includeInSitemap || page.generateFile) && !page.urlPath){
			throw new Error("Page requested sitemap/file generation, but has no url path. Don't know where to generate file or what to include in sitemap.");
		}

		return {
			render: page.render,
			getUrlPathsForSitemap: function*(){
				if(page.includeInSitemap && page.urlPath){
					yield page.urlPath;
				}
			},
			getUrlPathsOfFilesToWrite: function*(){
				if(page.generateFile && page.urlPath){
					yield page.urlPath;
				}
			},
			generationTestUrlPath: page.urlPath || "/",
			staticUrlPath: page.generateFile? page.urlPath: undefined
		}
	}

	setFileNotFoundPage(page: Lithograph.AuxiliaryPageDefinition<PageParams>): void {
		if(this.fileNotFoundPage){
			throw new Error("You cannot set fileNotFound page twice!");
		}

		this.fileNotFoundPage = this.addGenericPage(this.genericPageDefFromAuxPageDef(page));
	}

	setServerErrorPage(page: Lithograph.AuxiliaryPageDefinition<PageParams>): void {
		if(this.serverErrorPage){
			throw new Error("You cannot set serverErrorPage twice!");
		}

		this.serverErrorPage = this.addGenericPage(this.genericPageDefFromAuxPageDef(page));
	}

	*getAllSitemapEntries(): IterableIterator<string>{
		for(let page of this.allPages){
			for(let urlPath of page.getUrlPathsForSitemap()){
				yield urlPath;
			}
		}
	}

	private renderPage(urlPath: string, page: Lithograph.PageDefinition<PageParams>): string {
		return this.opts.doWithContext(urlPath, page.params, context => {
			let result = page.render(context);
			let shouldMinify = this.opts.minify() && !page.neverMinify;
			let shouldValidate = this.opts.validate() && !page.neverValidate;
			if(shouldMinify || shouldValidate){
				let min = HtmlMinifier.minify(result, {
					collapseBooleanAttributes: true,
					collapseInlineTagWhitespace: true,
					collapseWhitespace: true,
					decodeEntities: true,
					quoteCharacter: '"',
					removeComments: true,
					sortAttributes: true,
					sortClassName: true
				});

				if(shouldMinify){
					result = min;
				}
			}
			return result;
		});
	}

	pageToContentItem(urlPath: string, page: Lithograph.PageDefinition<PageParams>): Lithograph.ContentItemDescription {
		return {
			mime: allKnownMimeTypes.html, 
			urlPath, 
			responseType: "ok",
			getContent: () => this.renderPage(urlPath, page),
		}
	}

	describeContentItem(urlPath: string): Lithograph.ContentItemDescription | null {
		let base = { mime: allKnownMimeTypes.html, urlPath, responseType: "ok" as const }

		const staticPage = this.staticallyRoutedPages.get(urlPath);
		if(staticPage){
			return { ...base, getContent: () => this.renderPage(urlPath, staticPage) }
		}

		for(let i = 0; i < this.dynamicallyRoutedPages.length; i++){
			const page = this.dynamicallyRoutedPages[i];
			if(!page.matchesUrlPath){
				throw new Error("Malformed page storage!");
			}
			if(page.matchesUrlPath(urlPath)){
				return { ...base, getContent: () => this.renderPage(urlPath, page) }
			}
		}

		return null;
	}

	getFileNotFoundContent(urlPath: string): string {
		if(this.fileNotFoundPage){
			return this.renderPage(urlPath, this.fileNotFoundPage);
		} else {
			return "<h1>HTTP 404<h1><h2>File Not Found<h2>";
		}
	}

	getDefaultServerErrorContent(): string {
		return "<h1>HTTP 500<h1><h2>Server Error<h2>";
	}

	getRedirectContent(toUrlPath: string): string {
		return `<h1>Redirecting <a href="${toUrlPath}">here</a>...</h1>`
	}

	getServerErrorContent(): string {
		if(this.serverErrorPage){
			return this.renderPage("", this.serverErrorPage);
		} else {
			return this.getDefaultServerErrorContent();
		}
	}
	
	async onWriteAllToDisk(): Promise<void> {
		await Promise.all(this.allPages.map(async page => {
			let proms: Promise<void>[] = [];
			let havePage = false;
			for(let urlPath of page.getUrlPathsOfFilesToWrite()){
				havePage = true;
				let filePath = urlPath;
				if(filePath.endsWith("/")) {
					filePath += "index.html"
				} else if(!filePath.match(/\.html?$/i)){
					filePath += ".html";
				}
				filePath = this.opts.pathController.urlPathToFilePath(filePath);
				proms.push(writeFileAndCreateDirs(filePath, this.renderPage(urlPath, page)));
			}

			if(!havePage && this.opts.doDynamicGenerationTests() && page.generationTestUrlPath){
				this.renderPage(page.generationTestUrlPath, page);
			}

			await Promise.all(proms);
		}));
	}

}

function isRawUrlDefinedDynamicPageDefinition<K extends {[k:string]:string[]}, PageParams>(def: Lithograph.UrlDefinedDynamicPageDefinition<K, PageParams>): def is Lithograph.RawUrlDefinedDynamicPageDefinition<K, PageParams>{
	return !!(def as Lithograph.RawUrlDefinedDynamicPageDefinition<K, PageParams>).pathPattern;
}