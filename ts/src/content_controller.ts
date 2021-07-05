import {Lithograph} from "lithograph";


export interface LithographContentController {

	hasContentItem(urlPath: string): boolean;
	describeContentItem(urlPath: string): Lithograph.ContentItemDescription | null;

	onWidgetDefinitionCompleted?(): void | Promise<void>
	onResourceDefinitionCompleted?(): void | Promise<void>
	onPagesDefinitionCompleted?(): void | Promise<void>
	onWriteAllToDisk?(): void | Promise<void>

}