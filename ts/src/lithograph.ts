import {LithographContentSet} from "content_set";
import * as SASS from "sass";

export type SASSFunction<PageParams> = (this: Lithograph.RenderContext<PageParams>, ...args: SASS.types.SassType[]) => SASS.types.SassType | void;


export namespace Lithograph {

	export function createContentSet<PageParams extends Record<string, unknown>>(opts: ContentSetCommonOptions<PageParams>): ContentSet<PageParams> {
		return new LithographContentSet<PageParams>(opts);
	}

	export type RegisteredWidgetWithParams<T> = (parameters: T, body?: string | (string | null | undefined)[]) => string
	export type RegisteredWidgetWithoutParams = (body?: string | (string | null | undefined)[]) => string;
	export type RegisteredWidgetWithOptParams<T> = RegisteredWidgetWithParams<T> & RegisteredWidgetWithoutParams;
	export type WidgetWithParamsRenderFn<T, PageParams> = (context: Lithograph.RenderContext<PageParams>, parameters: T, body: string) => string
	export type WidgetWithoutParamsRenderFn<PageParams> = (context: Lithograph.RenderContext<PageParams>, body: string) => string;
	export type WidgetWithOptParamsRenderFn<T, PageParams> = (context: Lithograph.RenderContext<PageParams>, parameters: T | undefined, body: string) => string

	
	// all file-paths are relative to rootdir path
	export interface ContentSet<PageParams = unknown> {
		addWidgetWithoutParams(render: WidgetWithoutParamsRenderFn<PageParams>): RegisteredWidgetWithoutParams;
		addWidgetWithParams<T extends Record<string, unknown>>(render: WidgetWithParamsRenderFn<T, PageParams>): RegisteredWidgetWithParams<T>;
		addWidgetWithOptionalParams<T extends Record<string, unknown>>(render: WidgetWithOptParamsRenderFn<T, PageParams>): RegisteredWidgetWithOptParams<T>;
		createPathPatternMatcher<K extends {[k: string]: string[]}>(def: UrlPatternDefinition<K>): UrlPathPatternMatcher<K>;

		doneWithWidgets(): Promise<void>; // end of widget definition stage

		addSassItem(urlPath: string, filePath: string): void;
		addSassSource(dirOrFilePath: string): void;
		addSassFunction(name: string, fn: SASSFunction<PageParams>): void;

		addImploderProject(resultingJsUrlPath: string, tsconfigJsonFilePath: string, profile?: string): void;
		addExternalJsFile(filePath: string): void;
		addExternalJsDirectory(dirPath: string): void;

		setImageDirectory(filePath: string): void;
		setWebpDirectory(filePath: string): void;

		addResourceDirectory(dirPath: string): void;
		addResource(filePath: string): void;

		doneWithResources(): Promise<void>; // end of resource definition stage


		// PageDefinitions here are returned for router to point to
		addStaticPage(page: StaticPageDefinition<PageParams>): PageDefinition<PageParams>; // included in sitemap and generates a file by default
		addUrlDefinedDynamicPage<K extends {[k: string]: string[]}>(page: UrlDefinedDynamicPageDefinition<K, PageParams>): PageDefinition<PageParams>;
		addPlaintextPage(page: StaticPageDefinition<PageParams>): PageDefinition<PageParams>; // just plaintext file. not included anywhere by default
		addPage(page: PageDefinition<PageParams>): PageDefinition<PageParams>;

		// used when no file is found
		setPageRouter(router: PageRouter<PageParams>): void;

		// error pages are not included in sitemap and are not generating files by default
		setServerErrorPage(page: AuxiliaryPageDefinition<PageParams>): void; // HTTP 500
		setFileNotFoundPage(page: AuxiliaryPageDefinition<PageParams>): void; // HTTP 404

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

	export interface ContentSetCommonOptions<PageParams> {
		defaultPageParams: PageParams;
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
	export interface RouterResponsePage<PageParams> { page: PageDefinition<PageParams> }
	export interface RouterResponsePermanentRedirect { permanentRedirect: string }
	export interface RouterResponseTemporaryRedirect { temporaryRedirect: string }

	export type PageRouterResponse<PageParams> = RouterResponseNotFound |
		RouterResponsePage<PageParams> |
		RouterResponsePermanentRedirect |
		RouterResponseTemporaryRedirect

	export type PageRouter<PageParams> = (urlPath: string) => PageRouterResponse<PageParams>;

	export interface RenderContext<PageParams> {
		/** Root url of the site. Contains protocol, domain and so on. */
		readonly urlRoot: string;
		/** Path of currently generated content item */
		readonly urlPath: string;
		/** Will hashes be calculated at all during the current build? */
		readonly hasHashes: boolean;
		/** Are there separate webp directory defined? */
		readonly hasWebp: boolean;

		/** Parameters of currently rendered page */
		readonly pageParams: PageParams;

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

		readonly options: ContentSetCommonOptions<PageParams>;
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

	export interface WidgetDefinition<T, PageParams> {
		render(context: RenderContext<PageParams>, options: T): string;
	}

	export interface StaticPageDefinitionBase<PageParams> {
		render(context: RenderContext<PageParams>): string;
		includeInSitemap?: boolean;
		generateFile?: boolean;
		neverValidate?: boolean;
		neverMinify?: boolean;
		params?: Partial<PageParams>;
	}

	/** A definition of page that is not contains any content, but is returned on errors */
	export interface AuxiliaryPageDefinition<PageParams> {
		render(context: RenderContext<PageParams>): string;
		includeInSitemap?: boolean;
		generateFile?: boolean;
		urlPath?: string;
	}
	
	/** Most static page of them all */
	export interface StaticPageDefinition<PageParams> extends StaticPageDefinitionBase<PageParams> {
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
	export type UrlDefinedDynamicPageDefinition<K extends {[k: string]: string[]}, PageParams> = 
		RawUrlDefinedDynamicPageDefinition<K, PageParams> | PreparedUrlDefinedDynamicPageDefinition<K, PageParams>

	export interface RawUrlDefinedDynamicPageDefinition<K extends {[k: string]: string[]}, PageParams> extends UrlPatternDefinition<K> {
		params?: Partial<PageParams>;
		render(context: RenderContext<PageParams>): string;
		excludeFromSitemap?: boolean;
		renderToFiles?: boolean;
	}

	export interface PreparedUrlDefinedDynamicPageDefinition<K extends {[k: string]: string[]}, PageParams> {
		params?: Partial<PageParams>;
		render(context: RenderContext<PageParams>): string;
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
	export interface PageDefinition<PageParams> {
		render(context: RenderContext<PageParams>): string;
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
		/** This page should NEVER go through minification process.
		 * Use-case is text files like ROBOTS.txt */
		neverMinify?: boolean;
		/** Same as neverMinify, but for validation */
		neverValidate?: boolean;

		/** Some values related to page that will be passed with context when the page is rendered */
		params?: Partial<PageParams>;
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