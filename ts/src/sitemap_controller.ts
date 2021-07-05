import {allKnownMimeTypes} from "mime";
import {Lithograph} from "lithograph";
import {createAsyncWriteStream} from "lithograph_utils";
import {LithographPageController} from "page_controller";
import {LithographPathController} from "path_controller";
import {LithographContentController} from "content_controller";

export interface LithographSitemapControllerOptions {
	pathController: LithographPathController;
	pageController: LithographPageController;
	haveSitemap: () => boolean;
}

const sitemapXmlPath = "/sitemap.xml";

export class LithographSitemapController implements LithographContentController {

	constructor(private readonly opts: LithographSitemapControllerOptions){}

	hasContentItem(urlPath: string): boolean {
		return urlPath === sitemapXmlPath && this.opts.haveSitemap();
	}

	private buildSitemap(): string {
		let body = "";
		for(let urlPath of this.opts.pageController.getAllSitemapEntries()){
			let fullUrl = this.opts.pathController.resolveUrlPathToFullUrl(urlPath);
			body += `<url><loc>${fullUrl}</loc></url>\n`
		}

		return `<?xml version="1.0" encoding="UTF-8"?>
		<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
		${body}
		</urlset>`
	}

	describeContentItem(urlPath: string): Lithograph.ContentItemDescription | null {
		if(!this.hasContentItem(urlPath)){
			return null;
		}

		return {
			mime: allKnownMimeTypes.xml,
			urlPath,
			getContent: () => this.buildSitemap(),
			responseType: "ok"
		}
	}
	
	async onWriteAllToDisk(){
		if(!this.opts.haveSitemap()){
			return;
		}

		let filePath = this.opts.pathController.urlPathToFilePath(sitemapXmlPath);
		await createAsyncWriteStream(filePath, writer => {
			writer(this.buildSitemap());
		});
	}

}