// The parse() function (parse.js) expect a callback to which it will
// send the collection of artists. The index in the array is NOT the
// ID of the artist
parse(main);
var currentDepth = 0;

var svg = d3.select("#map"),
margin = 5,
diameter = +svg.attr("width"),
g = svg.append("g").attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")");

var pack = d3.pack()
.size([diameter - margin, diameter - margin])
.padding(3);

var color = d3.scaleLinear()
.domain([0, 1])
.range(["#C42D6A", "#318ECC"])
.interpolate(d3.interpolateHcl);

//On récupere la table artiste-id
var research;
d3.json("/collection/research.json", function(error, json) {
    research = json;
})

/**
  Merci https://rosettacode.org/wiki/Levenshtein_distance#JavaScript
*/
function levenshtein(a, b) {
  var t = [], u, i, j, m = a.length, n = b.length;
  if (!m) { return n; }
  if (!n) { return m; }
  for (j = 0; j <= n; j++) { t[j] = j; }
  for (i = 1; i <= m; i++) {
    for (u = [i], j = 1; j <= n; j++) {
      u[j] = a[i - 1] === b[j - 1] ? t[j - 1] : Math.min(t[j - 1], t[j], u[j - 1]) + 1;
    } t = u;
  } return u[n];
}

function onNodeClick(d) {
    currentDepth = d.depth;

    // S'il n'y a pas de noeud enfant, alors il s'agit d'un artiste et on
    // affiche le panneau latéral correspondant à l'artiste sur lequel on a cliqué
    if(! d.children){
        document.getElementById('research_artist').value = '';
        artist(d.data.id, main.getNameFormated(d.data.name));
    }
    else if (focus !== d){
        main.zoom(d);
    }
    else{
        main.zoom(d.parent);
    }

    d3.event.stopPropagation();
}

var nodes;
var root;
//recherche sur l'ensemble des artistes lorsqu'on appuie sur entrée dans le champ recherche
function researchKeyPressed(event) {
    if (event.keyCode == 13 && document.getElementById('research_artist').value != '') {
        var restext = document.getElementById('research_artist').value;

        var tablo = research.table;

        var minind = 0;
        var mincorresp=levenshtein(tablo[0].artist, restext);
        for (var i=1; i<tablo.length; i++) {
            if (levenshtein(tablo[i].artist, restext) < mincorresp) {
                mincorresp=levenshtein(tablo[i].artist, restext);
                minind=i;
            }
        }

        node = main.getById(tablo[minind].id);

        parent = main.getById(node._groups[0][0].__data__.parent.data.id);
        parent._groups[0][0].dispatchEvent(new Event('click'));
        artist(tablo[minind].id, tablo[minind].artist);
    }
}

function main(countries) {
    function getById(id) {
        return d3.select("#id" + id);
    }
    main.getById = getById;

    root = d3.hierarchy(countries)
    .sum(function(d) { return d.size; })
    .sort(function(a, b) { return b.value - a.value; });;

    var focus = root,
    nodes = pack(root).descendants(),
    view;

    // Création des nodes
    var circle = g.selectAll("circle")
    .data(nodes)
    .enter().append("circle")
    .attr("class", function(d) { return d.parent ? "node" : "node node--root"; })
    .attr("id", function (d) { return "id" + d.data.id })
    .style("fill", function(d) { return color(d.data.ratio); })
    .style("stroke-opacity", function(d) { return d.depth == 1 ? 1 : 0; })
    .style("display", function(d) { return d.parent === root || d.depth == 0 ? "inline" : "none"; })
    .on("click", onNodeClick);

    // Création des labels des nodes
    var text = g.selectAll("text")
    .data(nodes)
    .enter().append("text")
    .attr("class", "label")
    .style("fill", "white")
    .style("fill-opacity", function(d) { return d.parent === root ? 1 : 0; })
    .style("display", function(d) { return d.parent === root ? "inline" : "none"; })
    .text(function(d) {
        if(d.data.level_child == "Artwork"){
             return getNameFormated(d.data.name);
        }
        else{
            return d.data.name;
        }
    });

    var node = g.selectAll("circle,text");

    // Ajout d'un event qui dézoome sur l'ensemble du graphe au clic sur le background du svg
    svg.on("click", function() { zoom(root); currentDepth = 0 });

    zoomTo([root.x, root.y, root.r * 2 + margin]);

    function zoom(d) {
        var focus0 = focus;
        focus = d;

        d3.select("#infos_map").text("Level : "+d.data.level+" ["+d.data.name+"]");
        var transition = d3.transition()
        .duration(d3.event.altKey ? 7500 : 750)
        .tween("zoom", function(d) {
            var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2 + margin]);
            return function(t) { zoomTo(i(t)); };
        });

        transition.selectAll("text")
        .filter(function(d) { return d.parent === focus || this.style.display === "inline" || focus.parent === d || d === focus || d.parent === focus.parent;  })
        .style("fill-opacity", function(d) { return d.parent === focus ? 1 : 0; })
        .on("start", function(d) { if (d.parent === focus) this.style.display = "inline"; })
        .on("end", function(d) { if (d.parent !== focus) this.style.display = "none"; });

        transition.selectAll("circle")
        .filter(function(d) {
            return d.parent === focus || this.style.display === "inline" || focus.parent === d || d === focus || d.parent === focus.parent;
        })
        .style("fill-opacity", function(d) {
            return d.parent === focus || d.depth <= currentDepth ? 1 : 0;
        })
        .style("stroke-opacity", function(d) { return d.parent === focus || d.depth <= currentDepth ? 1 : 0; })
        .on("start", function(d) {
            if (d.parent === focus || d.depth <= currentDepth)
            this.style.display = "inline";
        })
        .on("end", function(d) {
            if (d.parent !== focus && d !== focus && d !== root && d.depth > currentDepth)
            this.style.display = "none";
        });
    }
    main.zoom = zoom;

    function fakeClick(d) {
        d3.event = { altKey: false };
        zoom(d);
    }
    main.fakeClick = fakeClick;

    function zoomTo(v) {
        var k = diameter / v[2];
        view = v;
        node.attr("transform", function(d) { return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")"; });
        circle.attr("r", function(d) { return d.r * k; });
    }

    function getNameFormated(_name){
        var res = _name.split(",");
        if(res.length > 1){
            return res[1]+" "+res[0];
        }
        return res[0];
    }
    main.getNameFormated = getNameFormated;
}
