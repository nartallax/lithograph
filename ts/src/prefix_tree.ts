
interface Node {
	children: {[k: string]: Node | undefined };
	isTerminal: boolean;
}

/** A way to present a set of strings in a way to make substring search easier.
 * match(haystack, startAt) searches any string in the set in haystack arg starting at startAt
 * this methond has O(n) complexity (where n is average length of strings in set) */
export class PrefixTree<K extends string = string> {

	private readonly root: Node;

	constructor(values: K[]){
		this.root = PrefixTree.buildTree(values);

	}

	private static buildTree(values: string[]): Node {
		let root: Node = { children: {}, isTerminal: false}

		for(let value of values){
			let current = root;
			for(let i = 0; i < value.length; i++){
				let char = value.charAt(i);
				current = current.children[char] ||= { children: {}, isTerminal: false };
			}
			current.isTerminal = true;
		}

		return root;
	}

	match(str: string, startAt: number): K | null {
		let node: Node | undefined = this.root;
		let lastResult = node.isTerminal? 0: -1;

		let limit = str.length - startAt;
		for(let offset = 0; offset < limit; offset++){
			let char = str.charAt(offset + startAt);
			node = node.children[char];

			if(!node){
				break;
			} else if(node.isTerminal){
				lastResult = offset + 1;
			}
		}

		return lastResult < 0? null: str.substr(startAt, lastResult) as K;
	}

}