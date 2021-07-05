import {test} from "@nartallax/clamsensor";
import {UrlPatternIterator} from "url_pattern_iterator";

let cars = ["volvo", "nissan", "kamaz"];
let cities = ["london", "paris", "sydney", "moscow"];

let valueLists = {
	cars, cities
}

test("empty patters yield zero results", assert => {
	assert([...new UrlPatternIterator({ valueLists, pathPattern: []})]).equalsTo([]);
});

test("constant paths", assert => {

	assert([...new UrlPatternIterator({ valueLists, pathPattern: [
		"cities/about/",
	]})]).equalsTo(["cities/about/"]);

	assert([...new UrlPatternIterator({ valueLists, pathPattern: [
		"cities/",
		"about/"
	]})]).equalsTo(["cities/about/"]);

	assert([...new UrlPatternIterator({ valueLists, pathPattern: [
		"cities/",
		"about/",
		"landmarks"
	]})]).equalsTo(["cities/about/landmarks"]);
});

test("alternating value types", assert => {
	assert([...new UrlPatternIterator({ valueLists, pathPattern: [
		"city/",
		{name:"cities"}
	]})]).equalsTo(["city/london", "city/paris", "city/sydney", "city/moscow"]);

	assert([...new UrlPatternIterator({ valueLists, pathPattern: [
		"city/",
		{name:"cities"},
		"/about"
	]})]).equalsTo(["city/london/about", "city/paris/about", "city/sydney/about", "city/moscow/about"]);


	assert([...new UrlPatternIterator({ valueLists, pathPattern: [
		"city/",
		{name:"cities"},
		"/from/",
		{name:"cities"}
	]})]).equalsTo([
		"city/london/from/london", "city/london/from/paris", "city/london/from/sydney", "city/london/from/moscow",
		"city/paris/from/london", "city/paris/from/paris", "city/paris/from/sydney", "city/paris/from/moscow",
		"city/sydney/from/london", "city/sydney/from/paris", "city/sydney/from/sydney", "city/sydney/from/moscow",
		"city/moscow/from/london", "city/moscow/from/paris", "city/moscow/from/sydney", "city/moscow/from/moscow"
	]);

	assert([...new UrlPatternIterator({ valueLists, pathPattern: [
		{name:"cities"},
		"/from/",
		{name:"cities"},
		"/cost"
	]})]).equalsTo([
		"london/from/london/cost", "london/from/paris/cost", "london/from/sydney/cost", "london/from/moscow/cost",
		"paris/from/london/cost", "paris/from/paris/cost", "paris/from/sydney/cost", "paris/from/moscow/cost",
		"sydney/from/london/cost", "sydney/from/paris/cost", "sydney/from/sydney/cost", "sydney/from/moscow/cost",
		"moscow/from/london/cost", "moscow/from/paris/cost", "moscow/from/sydney/cost", "moscow/from/moscow/cost"
	]);
});

test("dyns", assert => {

	assert([...new UrlPatternIterator({ valueLists, pathPattern: [
		{name:"cars"}
	]})]).equalsTo(cars);

	assert([...new UrlPatternIterator({ valueLists, pathPattern: [
		{name:"cities"},
		{name:"cars"}
	]})]).equalsTo([
		"londonvolvo", "londonnissan", "londonkamaz",
		"parisvolvo", "parisnissan", "pariskamaz",
		"sydneyvolvo", "sydneynissan", "sydneykamaz",
		"moscowvolvo", "moscownissan", "moscowkamaz"
	]);
});