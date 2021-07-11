import {LithographContentSet} from "content_set";
import * as Http from "http";
import {Lithograph} from "lithograph";
import {createAsyncReadStream, isFilePathContentItemDescription} from "lithograph_utils";

export interface LithographHttpServerOptions {
	contentSet: LithographContentSet;
	port: number;
	hostname?: string;
}

export class LithographHttpServer {

	private readonly server = new Http.Server(this.onRequest.bind(this));

	constructor(private readonly opts: LithographHttpServerOptions){}

	start(): Promise<void> {
		return new Promise((ok, bad) => {
			try {
				this.server.listen(this.opts.port, this.opts.hostname, ok);
			} catch(e){
				bad(e);
			}
		});
	}

	stop(): Promise<void> {
		return new Promise((ok, bad) => {
			this.server.close(err => err? bad(err): ok());
		})
	}

	private emitErrorAndClose(error: Error | string, req: Http.IncomingMessage, resp: Http.ServerResponse): void {
		console.error(`Fail to process HTTP ${req.method} to ${req.url}: ${typeof(error) === "string"? error: error.stack}`);
		resp.statusCode = 500;
		resp.statusMessage = "Server Error"
		resp.removeHeader("Content-Type"); // it may be set at response start
		resp.setHeader("Content-Type", "text/html");
		resp.end(this.opts.contentSet.getServerErrorPageContent());
	}

	private async onRequest(req: Http.IncomingMessage, resp: Http.ServerResponse): Promise<void> {
		try {
			await this.processRequest(req, resp);
		} catch(e){
			this.emitErrorAndClose(e, req, resp);
		}
	}

	async writeContentItem(contentItem: Lithograph.ContentItemDescription, resp: Http.ServerResponse): Promise<void> {
		resp.setHeader("Content-Type", contentItem.mime);
		if(isFilePathContentItemDescription(contentItem)){
			await createAsyncReadStream(contentItem.filePath, data => {
				if(typeof(data) === "string"){
					resp.write(data, "utf-8")
				} else {
					resp.write(data);
				}
			});
		} else {
			let content = await Promise.resolve(contentItem.getContent());
			resp.write(content);
		}

		resp.end();
	}

	private async processRequest(req: Http.IncomingMessage, resp: Http.ServerResponse): Promise<void>{
		if((req.method || "").toUpperCase() !== "GET"){
			resp.statusCode = 405;
			resp.statusMessage = "Method Not Allowed";
			resp.setHeader("Allow", "GET");
			resp.end("Method Not Allowed: GET expected, got " + req.method);
			return;
		}

		const urlStr = req.url;
		if(!urlStr){
			throw new Error("No URL in request!");
		}

		let url = new URL(urlStr, this.opts.contentSet.pathController.urlRoot);
		let urlPath = url.pathname;
		let contentItem = this.opts.contentSet.describeContentItem(urlPath);

		switch(contentItem.responseType){
			case "ok":
				resp.statusCode = 200;
				resp.statusMessage = "Ok";
				break;
			case "not_found":
				resp.statusCode = 404;
				resp.statusMessage = "Not Found";
				break;
			case "perm_redirect":
				resp.statusCode = 301;
				resp.statusMessage = "Moved Permanently"
				resp.setHeader("Location", contentItem.redirectTo);
				break;
			case "temp_redirect":
				resp.statusCode = 302;
				resp.statusMessage = "Found"
				resp.setHeader("Location", contentItem.redirectTo);
				break;
			default:
				throw new Error("Unknown content item type in " + JSON.stringify(contentItem));
		}

		await this.writeContentItem(contentItem, resp);
	}
	
}