import {LithographContentController} from "content_controller";
import {LithographContentSet} from "content_set";
import {Lithograph} from "lithograph";
import {escapeAttributeValue} from "lithograph_utils";

export interface LithographRenderContextOptions {
	contentSet: LithographContentSet;
	urlPath: string;
}

export class LithographRenderContext implements Lithograph.RenderContext {

	private readonly opts: Lithograph.ContentSetCommonOptions = this.contentSet.opts;

	constructor(protected readonly contentSet: LithographContentSet, public readonly urlPath: string){}

	resolveUrlPath(otherUrlPath: string): string {
		if(!this.isRelativeUrl(otherUrlPath)){
			throw new Error(`Could not resolve ${otherUrlPath} to absolute local url path: it's not relative url.`);
		}
		return this.contentSet.pathController.resolveUrlPath(otherUrlPath, this.urlPath);
	}

	getHash(urlPath: string): string | undefined {
		urlPath = this.resolveUrlPath(urlPath);
		let contentItem = this.contentSet.describeContentItem(urlPath);
		if(contentItem.responseType !== "ok"){
			throw new Error(`Content item at ${urlPath} could not possibly have hash: it's responce type is ${contentItem.responseType}`);
		}
		return contentItem.hash;
	}

	getHashOrThrow(urlPath: string): string {
		let result = this.getHash(urlPath);
		if(result === undefined){
			throw new Error(`Content item at ${urlPath} was expected to have hash, but it does not (required from page ${this.urlPath})`);
		}
		return result;
	}

	private hasResourceInControllerOrMimeBase(urlPath: string, controller: LithographContentController, mimeBase: string): boolean {
		if(controller.hasContentItem(urlPath)){
			return true;
		}

		let item = this.contentSet.describeContentItem(urlPath);
		if(item.responseType !== "ok"){
			return false;
		}

		return item.mime.startsWith(mimeBase);
	}

	get hasHashes(): boolean {
		return !this.opts.noHashes
	}

	get hasWebp(): boolean {
		return this.contentSet.imageController.hasWebp
	}

	get urlRoot(): string {
		return this.contentSet.pathController.urlRoot;
	}

	get options(): Lithograph.ContentSetCommonOptions {
		return this.opts;
	}

	urlPointsToContentItem(urlPath: string): boolean {
		urlPath = this.resolveUrlPath(urlPath);
		let item = this.contentSet.describeContentItem(urlPath)
		return item.responseType === "ok";
	}

	urlPointsToImage(urlPath: string): boolean {
		urlPath = this.resolveUrlPath(urlPath);
		return this.hasResourceInControllerOrMimeBase(urlPath, this.contentSet.imageController, "image/")
	}

	urlPointsToPage(urlPath: string): boolean {	
		urlPath = this.resolveUrlPath(urlPath);
		return this.contentSet.pageController.hasContentItem(urlPath)
			|| this.contentSet.terminalRoutingController.hasContentItem(urlPath);
	}

	urlPointsToCssFile(urlPath: string): boolean {
		urlPath = this.resolveUrlPath(urlPath);
		return this.hasResourceInControllerOrMimeBase(urlPath, this.contentSet.cssController, "text/css")
	}

	urlPointsToJsFile(urlPath: string): boolean {
		urlPath = this.resolveUrlPath(urlPath);
		return this.hasResourceInControllerOrMimeBase(urlPath, this.contentSet.tsJsController, "application/javascript")
	}

	getImageInfo(urlPath: string): Lithograph.ImageInfo {
		urlPath = this.resolveUrlPath(urlPath);
		return this.contentSet.imageController.getImageInfo(urlPath)
	}
	
	getImageWebpUrlPath(urlPath: string): string {
		urlPath = this.resolveUrlPath(urlPath);
		return this.contentSet.imageController.getImageWebpUrlPath(urlPath);
	}

	isRelativeUrl(url: string): boolean {
		return this.contentSet.pathController.isRelativeUrl(url)
	}
	
	isRelativeUrlPath(urlPath: string): boolean{
		return this.contentSet.pathController.isRelativeUrlPath(urlPath)
	}

	escapeAttribute(value: string): string {
		return escapeAttributeValue(value);
	}

}