import {LithographContentSet} from "content_set";
import * as SASS from "sass";

export type SASSFunction = (this: Lithograph.RenderContext, ...args: SASS.types.SassType[]) => SASS.types.SassType | void;


export namespace Lithograph {

	export function createContentSet(opts: ContentSetCommonOptions): ContentSet {
		return new LithographContentSet(opts);
	}
	
	// all file-paths are relative to rootdir path
	export interface ContentSet {
		addWidget<T>(render: (context: Lithograph.RenderContext, options: T) => string): (options: T) => string;
		createPathPatternMatcher<K extends {[k: string]: string[]}>(def: UrlPatternDefinition<K>): UrlPathPatternMatcher<K>;

		doneWithWidgets(): Promise<void>; // end of widget definition stage

		addSassItem(urlPath: string, filePath: string): void;
		addSassSource(dirOrFilePath: string): void;
		addSassFunction(name: string, fn: SASSFunction): void;

		addImploderProject(resultingJsUrlPath: string, tsconfigJsonFilePath: string, profile?: string): void;
		addExternalJsFile(filePath: string): void;
		addExternalJsDirectory(dirPath: string): void;

		setImageDirectory(filePath: string): void;
		setWebpDirectory(filePath: string): void;

		addResourceDirectory(dirPath: string): void;
		addResource(filePath: string): void;

		doneWithResources(): Promise<void>; // end of resource definition stage


		// PageDefinitions here are returned for router to point to
		addStaticPage(page: StaticPageDefinition): PageDefinition; // included in sitemap and generates a file by default
		addUrlDefinedDynamicPage<K extends {[k: string]: string[]}>(page: UrlDefinedDynamicPageDefinition<K>): PageDefinition;
		addPage(page: PageDefinition): PageDefinition;

		// used when no file is found
		setPageRouter(router: PageRouter): void;

		// error pages are not included in sitemap and are not generating files by default
		setServerErrorPage(page: AuxiliaryPageDefinition): void; // HTTP 500
		setFileNotFoundPage(page: AuxiliaryPageDefinition): void; // HTTP 404

		doneWithPages(): Promise<void>; // end of page definition stage

		writeAllToDisk(): Promise<void>;
		describeContentItem(urlPath: string): ContentItemDescription;
		getServerErrorPageContent(): string;
		startHttpServer(params: HttpServerParams): Promise<void>
		stopHttpServer(): Promise<void>;
	}

	export interface HttpServerParams {
		port: number;
		host?: string;
	}

	export type CssFileBuilder = (context: Lithograph.RenderContext) => string;

	export interface ContentSetCommonOptions {
		rootDirectoryPath: string;
		domain: string;
		port?: number;
		preferredProtocol: "http" | "https";
	
		useSitemap?: boolean;

		validateHtml?: boolean;
		minifyHtml?: boolean;
	
		minifyCss?: boolean;

		// calculating hash values of static content could take some time, so here's option to disable hashes
		noHashes?: boolean;
		// usually all dynamic pages are generated once at start just for early error detection, but it can be undesirable
		noDynamicGenerationTests?: boolean;
	}

	export type Writer = (part: Buffer | string) => void;

	export interface RouterResponseNotFound { notFound: true }
	export interface RouterResponsePage { page: PageDefinition }
	export interface RouterResponsePermanentRedirect { permanentRedirect: string }
	export interface RouterResponseTemporaryRedirect { temporaryRedirect: string }

	export type PageRouterResponse = RouterResponseNotFound |
		RouterResponsePage |
		RouterResponsePermanentRedirect |
		RouterResponseTemporaryRedirect

	export type PageRouter = (urlPath: string) => PageRouterResponse;

	export interface RenderContext {
		/** Root url of the site. Contains protocol, domain and so on. */
		readonly urlRoot: string;
		/** Path of currently generated content item */
		readonly urlPath: string;
		/** Will hashes be calculated at all during the current build? */
		readonly hasHashes: boolean;
		/** Are there separate webp directory defined? */
		readonly hasWebp: boolean;

		urlPointsToPage(urlPath: string): boolean;
		urlPointsToImage(urlPath: string): boolean;
		urlPointsToCssFile(urlPath: string): boolean;
		urlPointsToJsFile(urlPath: string): boolean;
		urlPointsToContentItem(urlPath: string): boolean;

		getImageInfo(urlPath: string): ImageInfo;
		getImageWebpUrlPath(urlPath: string): string;

		/** Resolve relative path to absolute */
		resolveUrlPath(urlPath: string): string;
		/** Does the url has protocol and/or domain, or it's just path (and maybe something further)? */
		isRelativeUrl(url: string): boolean;
		/** Is this url path relative (i.e. changes its value depending on resolution point)? */
		isRelativeUrlPath(urlPath: string): boolean;

		/** Escapes some symbols so string won't break HTML if used as attribute value. */
		escapeAttribute(value: string): string;

		getHash(urlPath: string): string | undefined;
		getHashOrThrow(urlPath: string): string;

		readonly options: ContentSetCommonOptions;
	}

	export interface ImageInfo {
		readonly width: number;
		readonly height: number;
		readonly format: string; // expected jpg, png etc
		readonly urlPath: string;
	}

	// Symbols of css block ids expected, other value keys will be ignored
	// typings loose here because of typescript
	export type WidgetCss = { readonly [k in symbol]: string }

	export interface WidgetDefinition<T> {
		render(context: RenderContext, options: T): string;
	}

	export interface StaticPageDefinitionBase {
		render(context: RenderContext): string;
		includeInSitemap?: boolean;
		generateFile?: boolean;
	}

	/** A definition of page that is not contains any content, but is returned on errors */
	export interface AuxiliaryPageDefinition {
		render(context: RenderContext): string;
		includeInSitemap?: boolean;
		generateFile?: boolean;
		urlPath?: string;
	}
	
	/** Most static page of them all */
	export interface StaticPageDefinition extends StaticPageDefinitionBase {
		urlPath: string;
	}

	export type UrlPathPattern<K> = ReadonlyArray<(string | {name: keyof K})>;
	export type ArrValueType<T> = T extends ReadonlyArray<infer V>? V: never;
	export type UrlPatternMatchingResult<K> = {[key in keyof K]: ArrValueType<K[key]>}

	export interface UrlPatternDefinition<K extends {[k: string]: string[]}> {
		// also handle query params here..? I don't need it right now, but it seems fitting
		valueLists: K;
		pathPattern: UrlPathPattern<K>;
	}

	/** Page that is generated dynamically based on url parts 
	 * Say, we have urls like /city/london and /city/moscow
	 * pathPattern for such urls should be ["/city/", {name: "city"}]
	 * and valueLists: {city: ["london", "moscow"] }
	 * You can either pass valueLists and pathPattern, or create matcher explicitly */
	export type UrlDefinedDynamicPageDefinition<K extends {[k: string]: string[]}> = 
		RawUrlDefinedDynamicPageDefinition<K> | PreparedUrlDefinedDynamicPageDefinition<K>

	export interface RawUrlDefinedDynamicPageDefinition<K extends {[k: string]: string[]}> extends UrlPatternDefinition<K> {
		render(context: RenderContext): string;
		excludeFromSitemap?: boolean;
		renderToFiles?: boolean;
	}

	export interface PreparedUrlDefinedDynamicPageDefinition<K extends {[k: string]: string[]}> {
		render(context: RenderContext): string;
		matcher: UrlPathPatternMatcher<K>;
		excludeFromSitemap?: boolean;
		renderToFiles?: boolean;
	}

	/** An object that handles path patterns */
	export interface UrlPathPatternMatcher<K> extends Iterable<string> {
		match(urlPath: string): UrlPatternMatchingResult<K> | null;
		matchOrThrow(urlPath: string): UrlPatternMatchingResult<K>;
	}

	/** Most generic page definition of them all */
	export interface PageDefinition {
		render(context: RenderContext): string;
		/** Get list of url paths of content items that should result in files being generated on disk */
		getUrlPathsOfFilesToWrite(): Iterable<string>;
		/** Get list of url paths of content items that will be present on disk */
		getUrlPathsForSitemap(): Iterable<string>;
		/** This path will be used in routing.
		 * If request path is equals to this path, request will resolve to this page */
		staticUrlPath?: string;
		/** Is this urlPath corresponds to this page? undefined/false means no.
		 * Used in routing. */
		matchesUrlPath?: (urlPath: string) => boolean;
		/** This path will be used when testing generation when getUrlPathsOfFilesToWrite returns nothing
		 * It won't result in file being wrote on disk; it's just a value to pass to page generation engine */
		generationTestUrlPath?: string;		
	}

	export type ContentItemResponceType = "ok" | "not_found" | "perm_redirect" | "temp_redirect";

	export interface ContentItemDescriptionBase {
		urlPath: string;
		mime: string;
		hash?: string;
	}

	export interface GenericContentItemDescription extends ContentItemDescriptionBase {
		responseType: "ok" | "not_found";
	}

	export interface RedirectContentItemDescription extends ContentItemDescriptionBase {
		responseType: "perm_redirect" | "temp_redirect";
		redirectTo: string;
	}

	export interface FilePathContentItemDescription extends ContentItemDescriptionBase {
		filePath: string
	}

	export interface ContentGeneratingContentItemDescription extends ContentItemDescriptionBase {
		getContent(): Buffer | string | Promise<Buffer | string>;
	}

	export type ContentItemDescription = (
		FilePathContentItemDescription | ContentGeneratingContentItemDescription
	) & (
		GenericContentItemDescription | RedirectContentItemDescription
	)

}