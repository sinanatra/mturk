const d3 = require('d3');
import { geoEquirectangular } from "d3-geo";
import { geoGuyou } from "d3-geo-projection";

var topojson = require("topojson")
let projection;

const Home = {
  init: () => {
    Home.map();
    Home.insertData();

    $(window).resize(function () {
      const svg = d3.select("#worldmap").remove()
      Home.map();
      Home.insertData();
    });

  },
  map: () => {
    const width = document.getElementById('map').offsetWidth;
    const height = document.getElementById('map').offsetHeight;
    projection = geoGuyou()
      .translate([width / 2, height / 2])

    if (window.innerWidth >= 1200) {
      projection
        .angle(-90)
        .rotate([18, -90]) // north pole in the center
    }
    if (window.innerWidth <= 1200) {
      projection
        .rotate([18, -90])
    }
    if (window.innerWidth <= 800) {
      projection
        .angle(-90)
        .rotate([18, -90])
        .scale(100)
    }

    const svg = d3.select("#map")
      .append("svg")
      .attr("id", "worldmap")
      .attr("viewBox", [0, 0, width, height])

    const path = d3.geoPath()
      .projection(projection)
    var g = svg.append("g");

    d3.json("https://gist.githubusercontent.com/sinanatra/91a7736f19e6636592703a459a8bfe75/raw/ca86b3ea72d66a68945624f3e933445c766aa28f/pixel25.json").then(function (topology) {
      var topo = topojson.feature(topology, topology.objects.pixel25);

      g.selectAll("path")
        .data(topo.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr('class', 'map')
    })
  },

  insertData: () => {
    d3.tsv("./windows.tsv")
      .then(function (tsv) {
        console.log(tsv)
        const div = d3
          .select(".images")
          .selectAll("img")
          .data(d3.shuffle(tsv))
          .enter()
          .append("div")
          .attr("data-attr", (d) => `${d["img"].replace("https://drive.google.com/u/0/open?usp=forms_web&id=", "")}`)
          .attr("class", (d) => "images-js")
          .on('mouseover', onMouseover)
          .on('mouseout', onMouseout)
        // .on('click', onMouseClick);

        div.append("a")
          .attr("target", "_blank")
          .attr("href", (d) => `https://drive.google.com/uc?export=view&id=${d["img"].replace("https://drive.google.com/u/0/open?usp=forms_web&id=", "")}`)
          .append("img")
          .attr("src", (d) => `https://drive.google.com/uc?export=view&id=${d["img"].replace("https://drive.google.com/u/0/open?usp=forms_web&id=", "")}`)
        div.append("h4")
          .text((d) => `${d["city"]}`)

        const svg = d3.select("#map svg")

        svg.selectAll(".mark")
          .data(tsv)
          .enter()
          .append("circle")
          .attr('class', 'mark')
          .attr('r', 3)
          .attr("data-attr", (d) => `${d["img"].replace("https://drive.google.com/u/0/open?usp=forms_web&id=", "")}`)
          .attr("class", (d) => "mark")
          .attr("transform", function (d) {
            return "translate(" + projection([d.Longitude, d.Latitude]) + ")";
          })
          .on('mouseover', onMouseover)
          .on('mouseout', onMouseout);


      });
  }
};

function onMouseover(elemData) {

  const self = d3.select(this),
    attr = self.attr('data-attr'),
    thisClass = self.attr('class')

  if (thisClass == "mark") {
    var posArray = this.getBoundingClientRect().bottom
    $(`.images-js[data-attr='${attr}']`)[0].scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });

  }

  d3.selectAll(`.images-js[data-attr='${attr}']`)
    .classed('color', true);

  d3.select(`circle[data-attr='${attr}']`)
    .attr('r', 12)
    .raise()

}

function onMouseout(elemData) {
  d3.select("svg").selectAll("circle")
    .attr('r', 3)

  d3.selectAll('.images-js')
    .classed('color', false);

}

function onMouseClick(elemData) {
  d3.selectAll(".image--zoom").classed('image--zoom', false);
  this.classList.toggle('image--zoom');
}
export default Home;



