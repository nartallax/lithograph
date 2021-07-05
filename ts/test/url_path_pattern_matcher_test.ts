import {test} from "@nartallax/clamsensor";
import {UrlPathPatternMatcher} from "url_path_patter_matcher";

let cars = ["volvo", "nissan", "kamaz"] as ("volvo" | "nissan" | "kamaz")[];
let cities = ["london", "paris", "sydney", "moscow"] as ("london" | "paris" | "sydney" | "moscow")[];
let users = ["admin", "anonymous"] as ("admin" | "anonymous")[];

let valueLists = {
	car: cars, city: cities, user: users
}

test("empty matcher", assert => {
	let matcher = new UrlPathPatternMatcher({valueLists,
		pathPattern: [],
	});

	assert(matcher.match("")).equalsTo({})
	assert(matcher.match("/")).equalsTo(null)
	assert(matcher.match("/test")).equalsTo(null)
});

test("const matcher", assert => {

	let matcher = new UrlPathPatternMatcher({valueLists,
		pathPattern: ["/test/path"],
	});

	assert(matcher.match("")).equalsTo(null);
	assert(matcher.match("/test/path")).equalsTo({});
	assert(matcher.match("/test/path/")).equalsTo(null);
	assert(matcher.match("/tEsT/pAtH")).equalsTo(null);
	assert(matcher.match("/tEsT/pAtH/")).equalsTo(null);
	assert(matcher.match("/whatever")).equalsTo(null);

});

test("single list matcher", assert => {

	let matcher = new UrlPathPatternMatcher({valueLists,
		pathPattern: [{name: "car"}],
	});

	assert(matcher.match("")).equalsTo(null);
	assert(matcher.match("/test")).equalsTo(null);
	assert(matcher.match("volvo")).equalsTo({car: "volvo"});
	assert(matcher.match("kamaz")).equalsTo({car: "kamaz"});
	assert(matcher.match("KAMaz")).equalsTo(null);
	assert(matcher.match("moscow")).equalsTo(null);
	
});

test("multi list matcher", assert => {

	let matcher = new UrlPathPatternMatcher({valueLists,
		pathPattern: ["", {name: "car"}, {name: "city"}, {name: "user"}],
	});

	assert(matcher.match("volvomoscowadmin")).equalsTo({car: "volvo", user: "admin", city: "moscow"})
	assert(matcher.match("volvomoscowadmini")).equalsTo(null)
	assert(matcher.match("volvomoscownothing")).equalsTo(null)
	assert(matcher.match("KAMazlondonanonymous")).equalsTo(null)
	assert(matcher.match("kamazlondonanonymous")).equalsTo({car: "kamaz", user: "anonymous", city: "london"})

});

test("mixed list matcher", assert => {

	let matcher = new UrlPathPatternMatcher({valueLists,
		pathPattern: ["/", {name: "car"}, "/", {name: "city"}, "/", "", {name: "user"}]
	});

	assert(matcher.match("/volvo/sydney/anonymous")).equalsTo({car: "volvo", city: "sydney", user: "anonymous"})
	assert(matcher.match("/KAMaz/sydney/anonymous")).equalsTo(null)
	assert(matcher.match("KAMaz/sydney/anonymous")).equalsTo(null);
	assert(matcher.match("/KAMaz/sydney/anonymous/")).equalsTo(null);

});

test("uppercase on pattern parts", assert => {
	let lists = {
		...valueLists,
		car: cars.map(x => x.toUpperCase())
	};

	let matcher = new UrlPathPatternMatcher({valueLists: lists,
		pathPattern: ["/CAR/", {name: "car"}, "/", {name: "city"}, "/", {name: "user"}]
	});

	assert(matcher.match("/CAR/VOLVO/sydney/anonymous")).equalsTo({car: "VOLVO", city: "sydney", user: "anonymous"})
	assert(matcher.match("/car/volvo/sydney/anonymous")).equalsTo(null)
});

test("overlapping values", assert => {
	// actually I really hope this will never happen in real life as it is very confusing
	// maybe I should detect it early

	let matcher = new UrlPathPatternMatcher({valueLists: {
			a: ["bana", "banana"],
			b: ["na-batman", "nana-batman"]
		},
		pathPattern: [{name: "a"}, {name: "b"}]
	});

	assert(matcher.match("banana-batman")).equalsTo(null)
	assert(matcher.match("bananana-batman")).equalsTo({a: "banana", b: "na-batman"})
	assert(matcher.match("banananana-batman")).equalsTo({a: "banana", b: "nana-batman"})

})