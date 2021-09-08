import {LithographContentController} from "content_controller";
import {LithographCssController} from "css_controller";
import {LithographFileResourceController} from "file_resource_controller";
import {LithographImageController} from "image_controller";
import {Lithograph, SASSFunction} from "lithograph";
import {LithographPageController} from "page_controller";
import {LithographPathController} from "path_controller";
import {LithographSitemapController} from "sitemap_controller";
import {LithographTsJsController} from "ts_js_controller";
import * as Path from "path";
import {LithographTerminalRoutingController} from "terminal_routing_controller";
import {LithographHttpServer} from "http_server";
import {LithographRenderContext} from "render_context";
import {UrlPathPatternMatcher} from "url_path_patter_matcher";

const StageNumbers = {
	"widgets": 1,
	"resources": 2,
	"pages": 3,
	"run": 4
}

function stageNameByNumber(stageNum: number): string {
	for(let name in StageNumbers){
		if(StageNumbers[name as  keyof typeof StageNumbers] === stageNum){
			return name;
		}
	}
	throw new Error("No stage name corresponds to number " + stageNum);
}

export class LithographContentSet implements Lithograph.ContentSet {
	private stage: number = StageNumbers.widgets;
	private httpServer: LithographHttpServer | null = null;

	constructor(readonly opts: Lithograph.ContentSetCommonOptions){
		this.opts.rootDirectoryPath = Path.resolve(this.opts.rootDirectoryPath);
	}

	private readonly widgets: Lithograph.WidgetDefinition<unknown>[] = [];
	private currentContext: Lithograph.RenderContext | null = null;
	private getCurrentContext(): Lithograph.RenderContext {
		if(!this.currentContext){
			throw new Error("Could not render widget outside of page!");
		}
		return this.currentContext;
	}

	private doWithContext<T>(urlPath: string, handler: (context: Lithograph.RenderContext) => T): T {
		this.checkStage(StageNumbers.run);

		if(this.currentContext){
			throw new Error(`Could not create another context: some context already present (old context is created for ${this.currentContext.urlPath}, new context is requested for ${urlPath})`);
		}

		this.currentContext = new LithographRenderContext(this, urlPath);

		try {
			return handler(this.currentContext);
		} finally {
			this.currentContext = null;
		}
	}

	readonly pathController = new LithographPathController({
		getRootDirectoryPath: () => this.opts.rootDirectoryPath,
		getDomain: () => this.opts.domain,
		getPreferredProtocol: () => this.opts.preferredProtocol,
		getPort: () => this.opts.port
	});

	readonly cssController = new LithographCssController({
		minify: () => !!this.opts.minifyCss,
		useHashes: () => !this.opts.noHashes,
		contentSet: this
	});

	readonly tsJsController = new LithographTsJsController({
		useHashes: () => !this.opts.noHashes,
		pathController: this.pathController
	});

	readonly imageController = new LithographImageController({
		pathController: this.pathController,
		useHashes: () => !this.opts.noHashes,
	});

	readonly fileResourceController = new LithographFileResourceController({
		pathController: this.pathController,
		useHashes: () => !this.opts.noHashes,
	});

	readonly pageController = new LithographPageController({
		pathController: this.pathController,
		doWithContext: this.doWithContext.bind(this),
		minify: () => !!this.opts.minifyHtml,
		validate: () => !!this.opts.validateHtml,
		doDynamicGenerationTests: () => !this.opts.noDynamicGenerationTests
	});

	readonly terminalRoutingController = new LithographTerminalRoutingController({
		pageController: this.pageController
	})

	readonly sitemapController = new LithographSitemapController({
		pathController: this.pathController,
		pageController: this.pageController,
		haveSitemap: () => !!this.opts.useSitemap
	})

	/** Content controllers in order they should process calls to describe().
	 * First non-null response is returned. */
	private readonly contentControllersDescribeOrder: ReadonlyArray<LithographContentController> = [
		this.sitemapController,
		this.tsJsController,
		this.cssController,
		this.imageController,
		this.pageController,
		this.fileResourceController,
		this.terminalRoutingController
	]

	/** Content controllers in order which stage events should be called
	 * CSS controller must go after file and image resource controllers so hashes are calculated on generation */
	private readonly contentControllersStageEventGroups: ReadonlyArray<ReadonlyArray<LithographContentController>> = [
		[
			this.tsJsController,
			this.imageController,
			this.fileResourceController,
		],
		[this.cssController],
		[this.pageController],
		[this.sitemapController],
		[this.terminalRoutingController]
	]

	private checkStage(stageNum: number){
		if(stageNum !== this.stage){
			throw new Error(`This action is done in wrong stage. Expected "${stageNameByNumber(stageNum)}", have "${stageNameByNumber(this.stage)}". Check your content set definition sequence.`)
		}
	}

	private async callStageEvents(stage: number, getHandler: (controller: LithographContentController) => undefined | (() => void | Promise<void>)): Promise<void>{
		this.checkStage(stage);
		for(let group of this.contentControllersStageEventGroups){
			await Promise.all(group.map(controller => {
				let handler = getHandler(controller);
				return Promise.resolve(handler && handler.call(controller));
			}));
		}
	}

	async doneWithWidgets(): Promise<void>{
		await this.callStageEvents(StageNumbers.widgets, x => x.onWidgetDefinitionCompleted);
		this.stage++;
	}

	async doneWithResources(): Promise<void>{
		await this.callStageEvents(StageNumbers.resources, x => x.onResourceDefinitionCompleted);
		this.stage++;
	}

	async doneWithPages(): Promise<void>{
		await this.callStageEvents(StageNumbers.pages, x => x.onPagesDefinitionCompleted);
		this.stage++;
	}

	async writeAllToDisk(): Promise<void> {
		await this.callStageEvents(StageNumbers.run, x => x.onWriteAllToDisk);
	}
	
	createPathPatternMatcher<K extends {[k: string]: string[]}>(def: Lithograph.UrlPatternDefinition<K>): Lithograph.UrlPathPatternMatcher<K> {
		return new UrlPathPatternMatcher(def);
	}

	addWidget<T>(render: (context: Lithograph.RenderContext, options: T) => string): (options: T) => string {
		this.checkStage(StageNumbers.widgets);
		let def = { render };
		this.widgets.push(def);
		return opts => def.render(this.getCurrentContext(), opts);
	}

	addSassItem(urlPath: string, filePath: string): void {
		this.checkStage(StageNumbers.resources);	
		this.pathController.checkUrlPathIsAbsoluteFilePath(urlPath);
		filePath = this.pathController.resolveFilePath(filePath, true);
		this.cssController.addSassItem(urlPath, filePath);
	}

	addSassSource(dirOrFilePath: string): void {
		this.checkStage(StageNumbers.resources);	
		dirOrFilePath = this.pathController.resolveFilePath(dirOrFilePath, true);
		this.cssController.addSassIncludePath(dirOrFilePath);
	}

	addSassFunction(name: string, fn: SASSFunction): void {
		this.checkStage(StageNumbers.resources);	
		this.cssController.addSassFunction(name, fn);
	}

	addImploderProject(resultingJsUrlPath: string, tsconfigJsonFilePath: string, profile?: string): void {
		this.checkStage(StageNumbers.resources);
		tsconfigJsonFilePath = this.pathController.resolveFilePath(tsconfigJsonFilePath, true);
		this.pathController.checkUrlPathIsAbsoluteFilePath(resultingJsUrlPath);
		this.tsJsController.addImploderProject(resultingJsUrlPath, tsconfigJsonFilePath, profile);
	}

	addExternalJsFile(filePath: string): void {
		this.checkStage(StageNumbers.resources);
		filePath = this.pathController.resolveFilePath(filePath);
		this.tsJsController.addScriptFile(filePath);
	}

	addExternalJsDirectory(dirPath: string): void {
		this.checkStage(StageNumbers.resources);
		dirPath = this.pathController.resolveFilePath(dirPath);
		this.tsJsController.addScriptDirectory(dirPath);
	}

	setImageDirectory(directoryPath: string): void {
		this.checkStage(StageNumbers.resources);
		directoryPath = this.pathController.resolveFilePath(directoryPath);
		this.imageController.setImageDirectory(directoryPath);
	}

	setWebpDirectory(directoryPath: string): void {
		this.checkStage(StageNumbers.resources);
		directoryPath = this.pathController.resolveFilePath(directoryPath);
		this.imageController.setWebpPath(directoryPath);
	}

	addResource(filePath: string): void {
		this.checkStage(StageNumbers.resources);
		filePath = this.pathController.resolveFilePath(filePath);
		this.fileResourceController.addFile(filePath);
	}

	addResourceDirectory(directoryPath: string): void {
		this.checkStage(StageNumbers.resources);
		directoryPath = this.pathController.resolveFilePath(directoryPath);
		this.fileResourceController.addDirectory(directoryPath);
	}

	addStaticPage(page: Lithograph.StaticPageDefinition): Lithograph.PageDefinition {
		this.checkStage(StageNumbers.pages);
		return this.pageController.addStaticPage(page);
	}

	addUrlDefinedDynamicPage<K extends {[k: string]: string[]}>(page: Lithograph.UrlDefinedDynamicPageDefinition<K>): Lithograph.PageDefinition {
		this.checkStage(StageNumbers.pages);
		return this.pageController.addUrlDefinedDynamicPage(page);
	}

	addPlaintextPage(page: Lithograph.StaticPageDefinition): Lithograph.PageDefinition {
		this.checkStage(StageNumbers.pages);
		return this.pageController.addPlaintextPage(page);
	}

	addPage(page: Lithograph.PageDefinition): Lithograph.PageDefinition {
		this.checkStage(StageNumbers.pages);
		return this.pageController.addGenericPage(page);
	}

	setPageRouter(router: Lithograph.PageRouter): void {
		this.checkStage(StageNumbers.pages);
		return this.terminalRoutingController.setRouter(router);
	}

	setServerErrorPage(page: Lithograph.AuxiliaryPageDefinition): void {
		this.checkStage(StageNumbers.pages);
		this.pageController.setServerErrorPage(page);
	}

	setFileNotFoundPage(page: Lithograph.AuxiliaryPageDefinition): void {
		this.checkStage(StageNumbers.pages);
		this.pageController.setFileNotFoundPage(page);
	}

	describeContentItem(urlPath: string): Lithograph.ContentItemDescription {
		for(let cc of this.contentControllersDescribeOrder){
			let item = cc.describeContentItem(urlPath);
			if(item){
				return item;
			}
		}

		throw new Error(`Queried all of content controllers, but got no content item description (for url path "${urlPath}"). This was not supposed to happen.`);
	}

	getServerErrorPageContent(): string {
		this.checkStage(StageNumbers.run);
		try {
			return this.pageController.getServerErrorContent();
		} catch(e) {
			console.error("Failed to generate error page: " + (e as Error).stack);
			return this.pageController.getDefaultServerErrorContent();
		}
	}

	startHttpServer(params: Lithograph.HttpServerParams): Promise<void> {
		this.checkStage(StageNumbers.run);
		if(this.httpServer){
			throw new Error("HTTP server is already running.");
		}
		this.httpServer = new LithographHttpServer({
			port: params.port,
			hostname: params.host,
			contentSet: this
		});

		return this.httpServer.start();
	}

	stopHttpServer(): Promise<void> {
		this.checkStage(StageNumbers.run);
		if(!this.httpServer){
			throw new Error("Cannot stop HTTP server: not running.");
		}
		let server = this.httpServer;
		this.httpServer = null;
		return server.stop();
	}

}