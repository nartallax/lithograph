import {LithographContentController} from "content_controller";
import {Lithograph} from "lithograph";
import {isNotFound, isPageRoutingResult, isPermRedirect, isTempRedirect} from "lithograph_utils";
import {allKnownMimeTypes} from "mime";
import {LithographPageController} from "page_controller";

export interface LithographRoutingControllerOptions<PageParams> {
	pageController: LithographPageController<PageParams>;
}

/** A class that resembles content controller, but never returns a null
 * Meant to be used as terminal content controller, which handles some special cases like redirects or routing smart logic */
export class LithographTerminalRoutingController<PageParams> implements LithographContentController {

	private router: Lithograph.PageRouter<PageParams> | null = null;
	constructor(private readonly opts: LithographRoutingControllerOptions<PageParams>){}

	setRouter(router: Lithograph.PageRouter<PageParams>): void {
		if(this.router){
			throw new Error("You cannot set page router twice!");
		}
		this.router = router;
	}

	hasContentItem(urlPath: string): boolean {
		return this.describeContentItem(urlPath).responseType === "ok"
	}

	describeContentItem(urlPath: string): Lithograph.ContentItemDescription {
		const resp: Lithograph.PageRouterResponse<PageParams> = !this.router? { notFound: true }: this.router(urlPath);

		if(isNotFound(resp)){
			return {
				responseType: "not_found",
				urlPath,
				mime: allKnownMimeTypes.html,
				getContent: () => this.opts.pageController.getFileNotFoundContent(urlPath)
			}
		}

		if(isPermRedirect(resp)){
			return {
				responseType: "perm_redirect",
				urlPath,
				redirectTo: resp.permanentRedirect,
				mime: allKnownMimeTypes.html,
				getContent: () => this.opts.pageController.getRedirectContent(resp.permanentRedirect)
			}
		}

		if(isTempRedirect(resp)){
			return {
				responseType: "temp_redirect",
				urlPath,
				redirectTo: resp.temporaryRedirect,
				mime: allKnownMimeTypes.html,
				getContent: () => this.opts.pageController.getRedirectContent(resp.temporaryRedirect)
			}
		}

		if(isPageRoutingResult(resp)){
			return this.opts.pageController.pageToContentItem(urlPath, resp.page)
		}

		throw new Error(`Failed to describe resource ${urlPath}: this is not correct routing result: ${JSON.stringify(resp)}`);
	}

}