import {test} from "@nartallax/clamsensor";
import {PrefixTree} from "prefix_tree";

test("basic", assert => {
	let tree = new PrefixTree(["abcd", "efgh"])

	assert(tree.match("", 0)).equalsTo(null);
	assert(tree.match("zzzz", 0)).equalsTo(null);
	assert(tree.match("abcd", 0)).equalsTo("abcd");
	assert(tree.match("abcdefgh", 0)).equalsTo("abcd");
	assert(tree.match("babcdefgh", 0)).equalsTo(null);
	assert(tree.match("babcdefgh", 1)).equalsTo("abcd");
	assert(tree.match("babcdefgh", 5)).equalsTo("efgh");
	assert(tree.match("babcd", 0)).equalsTo(null);
})

// those tests are coupled as empty and nested strings are essentially the same
test("empty and nested strings", assert => {
	let tree = new PrefixTree(["ab", "abcd", ""]);

	assert(tree.match("zzzz", 0)).equalsTo("")
	assert(tree.match("", 0)).equalsTo("")
	assert(tree.match("a", 0)).equalsTo("")
	assert(tree.match("ab", 0)).equalsTo("ab")
	assert(tree.match("abc", 0)).equalsTo("ab")
	assert(tree.match("abcd", 0)).equalsTo("abcd")
	assert(tree.match("abcdef", 0)).equalsTo("abcd")
	assert(tree.match("zzzz", 1)).equalsTo("")
	assert(tree.match("zabc", 1)).equalsTo("ab")
})

test("repeated strings", assert => {

	let tree = new PrefixTree(["abc", "abc", "zzz"]);
	
	assert(tree.match("zzzz", 0)).equalsTo("zzz")
	assert(tree.match("abc", 0)).equalsTo("abc")
	assert(tree.match("cba", 0)).equalsTo(null)
	assert(tree.match("", 0)).equalsTo(null)
});