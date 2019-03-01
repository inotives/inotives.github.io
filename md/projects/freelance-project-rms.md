### Room Monitoring System (RMS) <small style="font-size: 12px">Prototyping</small>
<div id="top"></div>

Room Monitoring System (RMS) is the system that handle collection, storing and displaying the data collected by 5 test sensor nodes provided by NXP sensor. The data is collected and stored into a server where the web services of RMS was hosted. The raw data from the sensor nodes was first analysed by a VB script before storing them to data base. RMS was created as a web system so that user could access it from any where without any prior installation and setting up.


#### Technology Used
---

- [HTML5](http://w3c.github.io/html/)
- CSS3
- Javascript
- [JQuery](https://jquery.com/)
- [PHP](http://php.net/)
- [MySQL](http://www.mysql.com/)
- NXP Sensor Node (Hardware)
- [WebGL - ThreeJS](http://threejs.org/)
- [XAMPP](https://www.apachefriends.org/index.html)
- [HighChart](http://www.highcharts.com/)
- [Autodesk - 3DS Max](http://www.autodesk.com/products/autodesk-3ds-max/overview)


[TOP](#top)



#### Details & Features
---

<div class="row">
  <div class="col l6 m6 s12">
    <h5>Real-time Sensor data</h5>
    <p>
     When mouseover to the sensor node, real-time information of that sensor such as illumination and battery level will be displayed. The area where the sensor is monitoring will also be highlighted in green. By clicking on the sensor nodes, it will bring user to the detail sensor graph.
    </p>
  </div>
  <div class="col l6 m6 s12">
    <img class="responsive-img" src="/images/main/projects/freelance-project-rms-001.jpeg">
  </div>
</div>

---

<div class="row">
  <div class="col l6 m6 s12">
    <img class="responsive-img" src="/images/main/projects/freelance-project-rms-002.jpeg">
  </div>

  <div class="col l6 m6 s12">
    <h5>Average Room Condition</h5>
    <p>
    When we average out all the data collected from all 5 sensor, we could obtain the average value for room condition. These values was computed real time and displayed on 4 bubble icons on the top right corner of the screen. These icons are not use only to display the average value, they are also button used to access a more detail graph of the system.
    </p>
  </div>
</div>

---

<div class="row">
  <div class="col l6 m6 s12">
    <h5>Sensor Node Graph</h5>
    <p>
      In this graph, all the data of collected by sensor is displayed. The graph was group into each zones and stack together all the parameter (temperature, illumination, etc) for easy viewing of the data. When mouse over to the graph, a small label box showing the data at that point will pop-up.
    </p>
    <p>
      This graph is plotted against the time recorded in seconds. user drag and select the bottom part of the graph to zoom particular area in the graph.
    </p>
  </div>
  <div class="col l6 m6 s12">
    <img class="responsive-img" src="/images/main/projects/freelance-project-rms-003.jpeg">
  </div>
</div>

---

<div class="row">
  <div class="col l6 m6 s12">
    <img class="responsive-img" src="/images/main/projects/freelance-project-rms-004.jpeg">
  </div>

  <div class="col l6 m6 s12">
    <h5>Zone Parameter Graph</h5>
    <p>
    This graph looks similar to sensor node graph, but it is different. It group the data into one parameter and stack together with all the zones for easy comparison of data such as how different is the temperature at different zone at that particular timing.
    </p>
    <p>The mouseover effect and zooming function of this graph is the same as sensor node graph. </p>
  </div>
</div>


[TOP](#top)


#### Showcase
---

Video Demo:
<div class="videoWrapper">
  <iframe width="560" height="315" src="https://www.youtube.com/embed/MKMR4IpzSRg" frameborder="0" allowfullscreen></iframe>
</div>

[TOP](#top)
