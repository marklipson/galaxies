$(function(){

  var center0 = [0,0,-0.06];
  var view0 = [[1,0,0],[0,1,0],[0,0,1]];
  var viewArea = $("#view");
  var canvas;
  var canvasWidth;
  var canvasHeight;
  var ctx, altCtx, altCanvas;
  var nearbyTable = [];

  function resize()
  {
    canvas = $("<canvas width='" + viewArea.width() + "' height='" + viewArea.height() + "'></canvas>");
    viewArea.html( canvas );
    canvasWidth = canvas.attr("width");
    canvasHeight = canvas.attr("height");
    ctx = canvas[0].getContext('2d');
    altCanvas = createCanvas( canvasWidth, canvasHeight );
    altCtx = altCanvas[0].getContext('2d');
    drawFrame();
  }
  function drawFrame()
  {
    viewer.draw( altCtx );
    ctx.drawImage( altCanvas[0], 0, 0 );
  }
  
  // data debugging
  if (false)
  {
    var oo = stars;
    console.log( "n = " + oo.length );
    for (var n=0; n < oo.length; n++)
    {
      var o = oo[n];
    }
  }
  
  galaxies.push({ x: 0, y: 0, z: 0, name: "Milky Way", home: true });
  stars.push({ x: 0, y: 0, z: 0, name: "Sol", home: true });
  for (var n=0; n < galaxyClusters.length; n++)
  {
    var gc = galaxyClusters[n];
    if (gc.x == 0  &&  gc.y == 0  &&  gc.z == 0)
    {
      gc.name = "Local Cluster";
      gc.home = true;
      break;
    }
  }
  if (stars)
  {
    // see http://www.vendian.org/mncharity/dir3/starcolor/
    var letters = "OBAFGKM";
    var colors = ["#9bb0ff","#aabfff","#cad7ff","#f8f7ff","#fff4ea","#ffd2a1","#ffcc6f"];
    for (var n=0; n < stars.length; n++)
    {
      if (! stars[n].s)
        continue;
      var spectrum = stars[n].s;
      var which = letters.indexOf( spectrum.charAt(0) );
      if (which >= 0)
        stars[n].color = colors[which];
      if (stars[n].M)
        stars[n].mag = Math.exp( stars[n].mag );
    }
  }
  
  // experimental - draw lines between nearby galaxies to show clustering
  function buildNearbyTable( threshold )
  {
    var nearby = [];
    var t2 = threshold * threshold;
    for (var a=0; a < this.objectList.length; a++)
    {
      var gA = this.objectList[a];
      for (var b=0; b < this.objectList.length; b++)
      {
        if (b == a)
          continue;
        var gB = this.objectList[b];
        var dx = gA.x-gB.x;
        if (Math.abs( dx ) > threshold)
          continue;
        var dy = gA.y-gB.y;
        var dz = gA.z-gB.z;
        var d2 = dx*dx+dy*dy+dz*dz;
        if (d2 > t2)
          continue;
        nearby.push({ a: a, b: b });
      }
    }
    nearbyTable = nearby;
  }
  //buildNearbyTable( 0.5 );
  
  // create an alternate canvas for double buffering
  function createCanvas( w, h )
  {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return $(c);
  }
  function clone( x )
  {
    var out;
    if ($.isArray( x ))
    {
      out = [];
      for (var n=0; n < x.length; n++)
        out[n] = x[n];
    }
    else
    {
      out = {};
      for (var e in x)
        if (x.hasOwnProperty(e))
          out[e] = x[e];
    }
    return out;
  }
  
  var viewer =
  {
    center: clone( center0 ),
    view: clone( view0 ),
    velocity: [0,0,0],
    angularVelocity: [0,0,0],
    friction: 0.2,
    isometric: false,
    isometricZ: 20,
    showNearby: false,
    zoom: 400,
    limitDistance: 500,
    speedMultiplier: 1,
    bgColor: '#000',
    objectColor: '#fff',
    objectRadius: 0.01,
    tPrev: new Date().getTime(),
    displayedObjects: [],
    highlightObject: null,
    objectList: galaxies,
    mode: "galaxies",
    
    /**
     * Choose which scale we're viewing.
     */
    setMode: function( mode )
    {
      var oldMode = this.mode;
      if (mode == "clusters")
      {
        this.objectList = galaxyClusters;
        this.objectRadius = 0.4;
        this.zoom = 200;
        this.speedMultiplier = 10;
      }
      else if (mode == "galaxies")
      {
        this.objectList = galaxies;
        this.objectRadius = 0.01;
        this.zoom = 400;
        this.speedMultiplier = 1;
      }
      else if (mode == "stars")
      {
        this.objectList = stars;
        this.objectRadius = 0.05;
        this.zoom = 400;
        this.speedMultiplier = 4;
      }
      else if (mode == "grid")
      {
        // test...
        var objs = [];
        for (var x=-10; x <= 10; x++)
          for (var y=-10; y <= 10; y++)
            for (var z=-10; z <= 10; z++)
            {
              var obj = {x: x, y: y, z: z, name: x+","+y+","+z };
              if (x == 0  &&  y == 0  &&  z == 0)
                obj.home = true;
              objs.push( obj );
            }
        this.objectList = objs;
        this.objectRadius = 0.04;
        this.zoom = 400;
        this.speedMultiplier = 1;
      }
      this.mode = mode;
      // reset position when changing coordinates
      function type(m)
      {
        if (m == "clusters"  ||  m == "galaxies")
          return "g";
        else
          return m;
      }
      if (type(oldMode) != type(mode))
      {
        this.center = clone( center0 );
        this.view = clone( view0 );
      }
      this.velocity = [0,0,0];
      this.angularVelocity = [0,0,0];
      $(".forMode").hide();
      $(".forMode." + mode).show();
    },

    tick: function()
    {
      var t = new Date().getTime();
      var dt = (t - this.tPrev)/1000;
      this.tPrev = t;
      var c = this.center;
      var v = this.velocity;
      c[0] += v[0] * dt;
      c[1] += v[1] * dt;
      c[2] += v[2] * dt;
      var f = Math.pow( this.friction, dt );
      v[0] *= f;
      v[1] *= f;
      v[2] *= f;
      var av = this.angularVelocity;
      if (av[0] != 0)
        this.rotate( 0, av[0] );
      if (av[1] != 0)
        this.rotate( 1, av[1] );
      if (av[2] != 0)
        this.rotate( 2, av[2] );
      av[0] *= f;
      av[1] *= f;
      av[2] *= f;
    },
    toScreenCoords: function( x, y, z )
    {
      var c = this.center;
      var v = this.view;
      var zoom = this.zoom;
      var dx = x - c[0];
      var dy = y - c[1];
      var dz = z - c[2];
      var vz = dx * v[2][0] + dy * v[2][1] + dz * v[2][2];
      if (vz <= 0  ||  vz > this.limitDistance)
        return null;
      var vx = dx * v[0][0] + dy * v[0][1] + dz * v[0][2];
      var vy = dx * v[1][0] + dy * v[1][1] + dz * v[1][2];
      var fz = this.isometric ? zoom / this.isometricZ : zoom / vz;
      var sx = vx * fz;
      var sy = vy * fz;
      if (Math.abs(sx) > 3000  ||  Math.abs(sy) > 3000)
        return null;
      sx += canvasWidth/2;
      sy = canvasHeight/2 - sy;
      return [sx,sy,this.isometric?this.isometricZ : vz];
    },
    draw: function( ctx )
    {
      ctx.fillStyle = this.bgColor;
      ctx.fillRect( 0, 0, canvasWidth, canvasHeight );
      var displayed = [];
      for (var nG=0; nG < this.objectList.length; nG++)
      {
        var galaxy = this.objectList[nG];
        var s = this.toScreenCoords( galaxy.x, galaxy.y, galaxy.z );
        if (! s)
          continue;
        var r = this.zoom * this.objectRadius / s[2];
        if (r > 3000)
          continue;
        var mag = (galaxy.mag ? (galaxy.mag) : 10) / s[2];
        if (mag > 0.7)
          mag = 0.7;
        if (mag < 0.1)
          mag = 0.1;
        var fadeClose = 1;
        if (r > 40)
          fadeClose = Math.sqrt(40)/Math.sqrt(r) - 0.08;
        if (fadeClose < 0.04)
          continue;
        ctx.globalAlpha = mag * fadeClose;
        if (galaxy.home)
          ctx.fillStyle = "#60ffc0";
        else if (galaxy.color)
          ctx.fillStyle = galaxy.color;
        else
          ctx.fillStyle = this.objectColor;
        if (r <= 0.6)
          ctx.fillRect( s[0], s[1], 1, 1 );
        else
        {
          ctx.beginPath();
          ctx.arc( s[0], s[1], r, 0, 6.2832, false );
          ctx.closePath();
          ctx.fill();
        }
        if (r > 1.5)
          displayed.push({ galaxy: galaxy, x: s[0], y: s[1], r: r, distance: s[2] });
        ctx.globalAlpha = 1;
        if (galaxy === this.highlightObject)
        {
          ctx.strokeStyle = "#ffffc0";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc( s[0], s[1], r+2, 0, 6.2832, false );
          ctx.closePath();
          ctx.stroke();
        }
      }
      if (this.showNearby)
      {
        var tbl = nearbyTable;
        ctx.strokeStyle = "#60ff60";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        for (var n=0; n < tbl.length; n++)
        {
          var gA = this.objectList[ tbl[n].a ];
          var gB = this.objectList[ tbl[n].b ];
          var sA = this.toScreenCoords( gA.x, gA.y, gA.z );
          if (! sA)
            continue;
          var sB = this.toScreenCoords( gB.x, gB.y, gB.z );
          if (! sB)
            continue;
          ctx.beginPath();
          ctx.moveTo( sA[0], sA[1] );
          ctx.lineTo( sB[0], sB[1] );
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      var c = this.center;
      $(".status").text( "your position: (" + c[0].toFixed(2) + "," + c[1].toFixed(2) + "," + c[2].toFixed(2) + ")")
      if (this.highlightObject)
      {
        var g = this.highlightObject;
        var d = Math.sqrt( g.x*g.x+g.y*g.y+g.z*g.z );
        var dly = d*3.26163344;
        var cat = $("<p/>");
        var type = this.mode.replace( /s$/, "" );
        cat.append( "highlighted: " + (g.name?g.name:"anonymous " + type) );
        cat.append( "<li>coords: (" + g.x.toFixed(2) + "," + g.y.toFixed(2) + "," + g.z.toFixed(2) + ")</li>" );
        cat.append( "<li>dist. from Sol: " + d.toFixed(1) + ((this.mode=='stars')?"pc" + " (" + dly.toFixed(1) + "ly)":"mpc" + " (" + dly.toFixed(1) + "Mly)") + "</li>" );
        $(".status").append( cat );
      }
      this.displayedObjects = displayed;
    },
    
    // rotate the viewpoint
    rotate: function( axis, angle )
    {
      var v = this.view;
      var c = Math.cos(angle);
      var s = Math.sin(angle);
      var a0 = axis;
      var a1 = (axis+1)%3;
      var a2 = (axis+2)%3;
      var v2 = [];
      v2[a0] = [ v[a0][0]*c - v[a1][0]*s, v[a0][1]*c - v[a1][1]*s, v[a0][2]*c - v[a1][2]*s ];
      v2[a1] = [ v[a0][0]*s + v[a1][0]*c, v[a0][1]*s + v[a1][1]*c, v[a0][2]*s + v[a1][2]*c ];
      v2[a2] = v[a2];
      this.view = v2;
    },

    // give the viewpoint some angular velocity
    spin: function( axis, amount )
    {
      var av = this.angularVelocity;
      av[axis] += amount;
    },

    // give the viewpoint some velocity
    move: function( axis, dist )
    {
      var push = true;
      dist /= 10;
      var c = push ? this.velocity : this.center;
      var v = this.view;
      c[0] += v[axis][0] * dist;
      c[1] += v[axis][1] * dist;
      c[2] += v[axis][2] * dist;
    }
    
  };
  
  resize();
  $(window).resize( resize );

  drawFrame();
  var tDraw = setInterval( function() {
    drawFrame();
  }, 50 );
  var tTick = setInterval( function() {
    viewer.tick()
  }, 10 );

  
  var overGalaxy;
  function movedOverGalaxy( g )
  {
    if (g)
      viewer.highlightObject = g.galaxy;
    else
      viewer.highlightObject = null;
  }
  
  canvas.mousemove(function(evt){
    var x = evt.clientX;
    var y = evt.clientY;
    var cP = $(evt.target).position();
    x -= cP.left;
    y -= cP.top;
    var over;
    var best = 10000;
    for (var nG=0; nG < viewer.displayedObjects.length; nG++)
    {
      var g = viewer.displayedObjects[nG];
      var dx = x - g.x;
      var dy = y - g.y;
      var d = Math.sqrt( dx*dx+dy*dy );
      if (d < g.r  &&  d < best)
      {
        over = g;
        best = d;
      }
    }
    movedOverGalaxy( over );
  });
  
  function key( keysdown, mult )
  {
    var fast = keysdown.k18; // alt
    var spin = keysdown.k16; // shift
    var base = viewer.speedMultiplier;
    var s = fast ? base*10 : base;
    var sA = fast ? 0.07 : 0.01;
    s *= mult;
    sA *= mult;
    if (keysdown.k37) // left
      if (spin)
        viewer.spin( 2, sA );
      else
        viewer.move( 0, -s );
    else if (keysdown.k39) // right
      if (spin)
        viewer.spin( 2, -sA );
      else
        viewer.move( 0, s );
    if (keysdown.k38)  // up
      if (spin)
        viewer.spin( 1, sA );
      else
        viewer.move( 1, s );
    else if (keysdown.k40) // down
      if (spin)
        viewer.spin( 1, -sA );
      else
        viewer.move( 1, -s );
    if (keysdown.k32) // forward (space)
      if (spin)
        viewer.spin( 0, sA );
      else
        viewer.move( 2, s );
    else if (keysdown.k8)  // backward (delete)
      if (spin)
        viewer.spin( 0, -sA );
      else
        viewer.move( 2, -s );
  }
  var keysdown = {};
  $(document).keydown(function(evt){
    var idx = "k"+evt.which;
    if (! keysdown[idx])
    {
      keysdown[idx] = true;
      // just pressing the key imparts some momentum
      //var single = { };
      //single[idx] = true;
      key( keysdown, 0.15 );
    }
    return false;
  });
  $(document).keyup(function(evt){
    delete keysdown["k"+evt.which];
  });
  {
    var t0 = new Date().getTime();
    setInterval( function(){
      var t1 = new Date().getTime();
      var dt = (t1 - t0)/1000;
      t0 = t1;
      // holding the key down imparts more momentum
      if (JSON.stringify(keysdown) != "{}")
        key( keysdown, 1.5 * Math.min(dt,1) );
    }, 10 );
  }
  $(document).keydown(function(evt){
    switch( evt.which )
    {
    case "0".charCodeAt(0): // home ('0')
      viewer.center = clone( center0 );
      viewer.view = clone( view0 );
      viewer.velocity = [0,0,0];
      break;
    }
    return false;
  });

  /**
   * Set up a button to toggle through a list of values.
   */
  $.fn.toggleButton = function( names, onChanged )
  {
    var btn = this;
    btn.click(function(){
      var nCurrent = 0;
      for (var n=0; n < names.length; n++)
        if (names[n] == btn.text())
          nCurrent = n;
      var newValue = names[ (nCurrent + 1) % names.length ];
      btn.text( newValue );
      onChanged( newValue );
    });
    // set initial value
    btn.text( names[0] );
    onChanged( names[0] );
  };
  $(".zoom").toggleButton( ["medium","close","far"], function(mode){
    if (mode == "very far")
      viewer.zoom = 100;
    else if (mode == "far")
      viewer.zoom = 250;
    else if (mode == "medium")
      viewer.zoom = 500;
    else if (mode == "close")
      viewer.zoom = 1000;
  });
  $(".mode").toggleButton( ["stars","galaxies","clusters","grid"], function(mode){
    viewer.setMode( mode );
  });
  $(".isometric").toggleButton( ["off","on"], function(mode){
    viewer.isometric = (mode == "on");
  });
  /*
  $(".nearby").click(function(){
    if (nearbyTable.length == 0)
      buildNearbyTable( 0.5 );
    viewer.showNearby = ! viewer.showNearby;
  });
  */
  
  $(".minimize").click(function(){
    var panel = $(this).closest(".panel");
    var body = panel.find(".body");
    if (body.is(":visible"))
    {
      body.slideUp();
      $(this).text("+");
    }
    else
    {
      body.slideDown();
      $(this).text("-");
    }
  });
  
});
//TODO smooth run back to '0'
//TODO galaxy clusters seem suspicious - can't see voids, etc., compare to galaxies
//TODO page resize
