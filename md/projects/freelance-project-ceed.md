### Campus Energy Efficiency Monitoring <small style="font-size: 12px">Prototype</small>
<div id="top"></div>

Energy monitoring dashboard prototype created for Energy Research Institute @ NTU (ERI@N). The aim of this project was to create a system that allow user to access to energy information such as total usage, usage breakdown, total cost and more anytime anywhere without any need of installation. The System must also provide information in a more intuitive way such as graphical view and dynamic 3D map. Ease of use of the system and enhance user experience also included as the main factor in developing this system.


#### Technology Used
---
These are the tech and tools used in this project:

- [HTML5](http://w3c.github.io/html/)
- CSS3
- Javascript
- [JQuery](https://jquery.com/)
- [PHP](http://php.net/)
- [MySQL](http://www.mysql.com/)
- [WebGL - ThreeJS](http://threejs.org/)
- [XAMPP](https://www.apachefriends.org/index.html)
- [HighChart](http://www.highcharts.com/)
- [Autodesk - 3DS Max](http://www.autodesk.com/products/autodesk-3ds-max/overview)

[TOP](#top)


#### Features
---

<div class="row">
  <div class="col l6 m6 s12">
    <h5>Login Validation</h5>
    <p>
     Our users are campus energy managers, lab technicians and various department energy officers. Login was in place to ensure only user with correct credential are able to log into the system to view the information.
    </p>
  </div>

  <div class="col l6 m6 s12">
    <img class="responsive-img" src="/images/main/projects/freelance-project-ceed-001.jpeg">
  </div>
</div>

---

<div class="row">
  <div class="col l6 m6 s12">
    <img class="responsive-img" src="/images/main/projects/freelance-project-ceed-002.jpeg">
  </div>

  <div class="col l6 m6 s12">
    <h5>3D Campus Map</h5>
    <p>
      The 3D map of the whole campus was created using Autodesk 3DS Max. The created models was exported to javascript object using the plugins exporter from ThreeJs. Finally with use of javascript, we loaded all the 3D model into the system.
    </p>
    <p>
      With the support of WebGL, all the loaded 3D model Json was rendered smoothly. all the 3D model was created with minimum vertices for increase the speed of the loading.
    </p>
  </div>
</div>

---

<div class="row">
  <div class="col l6 m6 s12">
    <h5>Zoom, Pan, Move and Realtime updates</h5>
    <p>
      Full navigation for 3D map such as zooming, panning and rotating was all available for user. All the movement was coded from scratch usint HTML canvas and WebGL control class. Each building will be highlighted and display latest energy usage of that building.
    </p>
  </div>

  <div class="col l6 m6 s12">
    <img class="responsive-img" src="/images/main/projects/freelance-project-ceed-003.jpeg">
  </div>
</div>

---

<div class="row">
  <div class="col l6 m6 s12">
    <img class="responsive-img" src="/images/main/projects/freelance-project-ceed-004.jpeg">
  </div>

  <div class="col l6 m6 s12">
    <h5>Detail Dashboard with time range selector</h5>
    <p>
      A system dashboard was also available for vieweing the detail breakdown of the usage. It provide the breakdown of the usage by types such as Chiller, AHU, lighting and plug load. Other than usage breakdown, user could also view the detail usage in different timing.
    </p>
  </div>
</div>

---

<div class="row">
  <div class="col l6 m6 s12">
    <h5>Current data vs Past data</h5>
    <p>
      Users are able to compute the historical data of the system and compare them with current data. This feature user to better visuallize the data. Comparison can be in days, week, month or year with a button.
    </p>
  </div>

  <div class="col l6 m6 s12">
    <img class="responsive-img" src="/images/main/projects/freelance-project-ceed-005.jpeg">
  </div>
</div>

---

<div class="row">
  <div class="col l6 m6 s12">
    <img class="responsive-img" src="/images/main/projects/freelance-project-ceed-006.jpeg">
  </div>

  <div class="col l6 m6 s12">
    <h5>Usage-Price Conversion</h5>
    <p>
      For user that are more interested in the cost of energy used, the system provided a simple button to convert between cost and usage. All the graph and corresponding chart value will also be convert accordingly.
    </p>
  </div>
</div>

---

<div class="row">
  <div class="col l6 m6 s12">
    <h5>Usage Alert</h5>
    <p>
      The system also provide a warning for the user. User could view the warning by clicking on the current status on the top right corner. A color coded icons of each building show how much energy each building had used versus the threshold set.
    </p>
  </div>

  <div class="col l6 m6 s12">
    <img class="responsive-img" src="/images/main/projects/freelance-project-ceed-007.jpeg">
  </div>
</div>



[TOP](#top)


#### Demo
---

Video Demo:
<div class="videoWrapper">
  <iframe width="560" height="315" src="https://www.youtube.com/embed/LhpkPiG87S4" frameborder="0" allowfullscreen></iframe>
</div>

[TOP](#top)
