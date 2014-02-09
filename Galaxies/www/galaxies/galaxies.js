$(function(){

  var d2r = Math.PI / 180;
  var center0 = [0,-0.1,0];
  var view0 = [[1,0,0],[0,0,1],[0,1,0]];
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
    
    function movedOverGalaxy( g )
    {
      if (g)
        viewer.highlightObject = g.galaxy;
      else
        viewer.highlightObject = null;
    }
    // mouse move: highlight objects
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
    // double click: point toward that point
    canvas.dblclick(function(evt){
      var pt;
      var o = viewer.highlightObject;
      if (! o)
        return;
      pt = [o.x,o.y,o.z];
      viewer.turnToward( pt );
    });
  }
  function drawFrame()
  {
    viewer.draw( altCtx );
    ctx.drawImage( altCanvas[0], 0, 0 );
  }
  function rgbToColor( rgb )
  {
    var rr = Math.min(Math.round(rgb[0]),255).toString(16);
    if (rr.length < 2)
      rr = "0" + rr;
    var gg = Math.min(Math.round(rgb[1]),255).toString(16);
    if (gg.length < 2)
      gg = "0" + gg;
    var bb = Math.min(Math.round(rgb[2]),255).toString(16);
    if (bb.length < 2)
      bb = "0" + bb;
    return "#" + rr + gg + bb;
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
  
  // patch up object lists
  galaxies.push({ x: 0, y: 0, z: 0, name: "Milky Way", home: true });
  stars.push({ x: 0, y: 0, z: 0, M: 4.83, name: "Sol", home: true });
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
    var rgb = [ [0x9b,0xb0,255],[166,0xbf,255],[0xca,0xd7,255],[0xf8,0xf7,255],[255,0xf4,0xea],[255,0xd2,0xa1],[255,0xcc,0x6f] ];
    var brMax = 100;
    for (var n=0; n < stars.length; n++)
    {
      var br = 1;
      if (stars[n].M)
      {
        br = 10*Math.exp( -stars[n].M );
        stars[n].mag = br;
        if (br > brMax)
          br = brMax;
        if (br < 0.01)
          br = 0.01;
        stars[n].r = Math.sqrt(br)*4;
      }
      else
        stars[n].mag = 1;
      if (stars[n].s)
      {
        var spectrum = stars[n].s;
        var which = letters.indexOf( spectrum.charAt(0) );
        if (which >= 0)
        {
          var c = rgb[ which ];
          var mC = Math.sqrt( c[0]*c[0] + c[1]*c[1] + c[2]*c[2] );
          mC = Math.sqrt(3) * (144 + br*111/brMax) / mC;
          c = [ c[0]*mC, c[1]*mC, c[2]*mC ];
          stars[n].color = rgbToColor( c );
        }
      }
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
    limitDistance: 1500,
    speedMultiplier: 1,
    showCoords: 0,
    fuzzy: false,
    bgColor: '#000',
    objectColor: '#fff',
    homeColor: "#60ffc0",
    //homeColor: "#e0e080",
    objectRadius: 0.01,
    objectRadiusMult: 0.012,
    tPrev: new Date().getTime(),
    displayedObjects: [],
    highlightObject: null,
    objectList: stars,
    mode: "galaxies",
    searchValue: null,
    searchHits: 0,
    searchCenter: null,
    
    /**
     * Choose which scale we're viewing.
     */
    setMode: function( mode )
    {
      var oldMode = this.mode;
      if (mode == "clusters")
      {
        this.objectList = galaxyClusters;
        this.objectRadius = 8;
        this.zoom = 200;
        this.speedMultiplier = 10;
        this.fuzzy = true;
      }
      else if (mode == "galaxies")
      {
        this.objectList = galaxies;
        this.objectRadius = 0.2;
        this.zoom = 400;
        this.speedMultiplier = 1;
        this.fuzzy = true;
      }
      else if (mode == "stars")
      {
        this.objectList = stars;
        this.objectRadius = 1;
        this.zoom = 400;
        this.speedMultiplier = 4;
        this.fuzzy = false;
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
        this.objectRadius = 1.5;
        this.zoom = 400;
        this.speedMultiplier = 1;
        this.fuzzy = false;
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
    toScreenCoords: function( x, y, z, opts )
    {
      var imposeLimit = ! opts  ||  opts.imposeLimit;
      if (this.isometric)
        imposeLimit = false;
      var c = this.center;
      var v = this.view;
      var zoom = this.zoom;
      var dx = x - c[0];
      var dy = y - c[1];
      var dz = z - c[2];
      var vz = dx * v[2][0] + dy * v[2][1] + dz * v[2][2];
      if (vz <= 0)
        return null;
      if (imposeLimit  &&  vz > this.limitDistance)
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
      if (this.showCoords)
        this.drawCoords( ctx, this.showCoords );
      var displayed = [];
      var radiusMult = this.zoom * this.objectRadiusMult;
      var defaultObjectRadius = this.objectRadius * radiusMult;
      var nHits = 0;
      var searchValue = this.searchValue ? this.searchValue.toLowerCase() : null;
      var searchC = [0,0,0];
      var searchM = 0;
      for (var nG=0; nG < this.objectList.length; nG++)
      {
        var galaxy = this.objectList[nG];
        var match = false;
        var gMag = galaxy.mag ? galaxy.mag : 0.2;
        if (searchValue  &&  galaxy.name  &&  galaxy.name.toLowerCase().indexOf( searchValue ) != -1)
        {
          match = true;
          nHits ++;
          var m = 
          searchM += gMag;
          searchC[0] += galaxy.x * gMag;
          searchC[1] += galaxy.y * gMag;
          searchC[2] += galaxy.z * gMag;
        }
        var s = this.toScreenCoords( galaxy.x, galaxy.y, galaxy.z );
        if (! s)
          continue;
        var rO = defaultObjectRadius;
        if (galaxy.r)
          rO = galaxy.r * radiusMult;
        var r = rO / s[2];
        if (r > 3000)
          continue;
        var mag = gMag / Math.sqrt(s[2]);
        if (mag > 0.7)
          mag = 0.7;
        if (mag < 0.3)
          mag = 0.3;
        var fadeClose = 1;
        if (r > 40)
          fadeClose = Math.sqrt(40)/Math.sqrt(r) - 0.08;
        if (fadeClose < 0.04)
          continue;
        ctx.globalAlpha = mag * fadeClose;
        if (galaxy.home)
          ctx.fillStyle = this.homeColor;
        else if (galaxy.color)
          ctx.fillStyle = galaxy.color;
        else
          ctx.fillStyle = this.objectColor;
        if (r <= 0.6)
          ctx.fillRect( s[0], s[1], 1, 1 );
        else
        {
          var r0 = this.fuzzy ? 2 : 6;
          var r1 = this.fuzzy ? 4 : 12;
          if (r > r0)
          {
            var a = ctx.globalAlpha;
            var nLvl = this.fuzzy ? 12 : 8;
            var aa = this.fuzzy ? 0.19  : 0.33;
            var edge = this.fuzzy ? 0.8 : 0.25;
            if (r < r1)
              edge *= (r-r0)/(r1-r0);
            for (var lvl=0; lvl < nLvl; lvl++)
            {
              ctx.globalAlpha = a * (nLvl-lvl)/nLvl * aa;
              ctx.beginPath();
              var r1 = r*(1-edge) + r*edge * ((lvl+1)/nLvl);
              ctx.arc( s[0], s[1], r1, 0, 6.2832, false );
              ctx.closePath();
              ctx.fill();
            }
          }
          else
          {
            ctx.beginPath();
            ctx.arc( s[0], s[1], r, 0, 6.2832, false );
            ctx.closePath();
            ctx.fill();
          }
        }
        if (r > 1.5  ||  mag > 0.5)
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
        if (match)
        {
          ctx.strokeStyle = "#80c0ff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc( s[0], s[1], r+4, 0, 6.2832, false );
          ctx.closePath();
          ctx.stroke();
        }
      }
      this.searchHits = nHits;
      if (searchM)
        this.searchCenter = [ searchC[0]/searchM, searchC[1]/searchM, searchC[2]/searchM ];
      else
        this.searchCenter = null;
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
      if (this.searchValue)
        $(".status").append( "<br/>search: " + this.searchHits + " object(s) found" );
      if (this.highlightObject)
      {
        var g = this.highlightObject;
        var d = Math.sqrt( g.x*g.x+g.y*g.y+g.z*g.z );
        var dly = d*3.26163344;
        var dI = Math.sqrt( (c[0]-g.x)*(c[0]-g.x)+(c[1]-g.y)*(c[1]-g.y)+(c[2]-g.z)*(c[2]-g.z) );
        var dIly = dI*3.26163344;
        var cat = $("<p/>");
        var type = this.mode.replace( /s$/, "" );
        cat.append( "highlighted: " + (g.name?g.name:"anonymous " + type) );
        cat.append( "<li>xyz: (" + g.x.toFixed(2) + "," + g.y.toFixed(2) + "," + g.z.toFixed(2) + ")</li>" );
        if (this.mode == "stars")
        {
          var polar = toPolarHuman( g.x, g.y, g.z );
          if (polar)
            cat.append( "<li>ra/decl from Sol: " + polar[0] + ", " + polar[1] + "</li>" );
        }
        cat.append( "<li>dist. from Sol: " + d.toFixed(1) + ((this.mode=='stars')?"pc" + " (" + dly.toFixed(1) + "ly)":"mpc" + " (" + dly.toFixed(1) + "Mly)") + "</li>" );
        cat.append( "<li>dist. from you: " + dI.toFixed(1) + ((this.mode=='stars')?"pc" + " (" + dIly.toFixed(1) + "ly)":"mpc" + " (" + dIly.toFixed(1) + "Mly)") + "</li>" );
        if (g.M)
          cat.append( "<li title='absolute magnitude'>M: " + g.M.toFixed(2) + "</li>" );
        $(".status").append( cat );
      }
      this.displayedObjects = displayed;
    },
    
    // draw coordinate system
    drawCoords: function( ctx, res )
    {
      var r = 1000000;
      for (var lat=-90+res; lat <= 90; lat += res)
      {
        var b = lat * d2r;
        var b0 = (lat-res) * d2r;
        var cb = Math.cos(b);
        var sb = Math.sin(b);
        var cb0 = Math.cos(b0);
        var sb0 = Math.sin(b0);
        var p = null;
        for (var lng=0; lng <= 360; lng += res)
        {
          var a = lng * d2r;
          var x = cb*Math.cos(a)*r;
          var y = cb*Math.sin(a)*r;
          var z = sb*r;
          var x0 = cb0*Math.cos(a)*r;
          var y0 = cb0*Math.sin(a)*r;
          var z0 = sb0*r;
          var s = this.toScreenCoords( x, y, z, { imposeLimit: false } );
          var s0 = this.toScreenCoords( x0, y0, z0, { imposeLimit: false } );
          if (p  &&  s  &&  lat < 90)
          {
            ctx.lineWidth = (lat % 30 == 0) ? 2 : 1;
            ctx.globalAlpha = (lat % 30 == 0) ? 0.5 : 0.3;
            ctx.strokeStyle = "#008000";
            ctx.beginPath();
            ctx.moveTo( p[0], p[1] );
            ctx.lineTo( s[0], s[1] );
            ctx.stroke();
          }
          if (s0  &&  s)
          {
            ctx.lineWidth = (lng % 30 == 0) ? 2 : 1;
            ctx.globalAlpha = (lng % 30 == 0) ? 0.5 : 0.3;
            ctx.strokeStyle = "#008000";
            ctx.beginPath();
            ctx.moveTo( s0[0], s0[1] );
            ctx.lineTo( s[0], s[1] );
            ctx.stroke();
          }
          p = s;
        }
      }
      ctx.globalAlpha = 1;
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
    },
    
    /**
     * Point toward a given coordinate.
     */
    pointToward: function( target, pct )
    {
      var c = this.center;
      var vI = vecSub( target, c );
      var rI = normalize( vI );
      if (rI < 0.001)
        return;
      var vU = [0,0,1];
      var vR = vecCross( vI, vU );
      var rR = normalize( vR );
      if (rR < 0.01)
      {
        vR = [1,0,0];
        vU = vecCross( vI, vR );
        normalize( vU );
        vR = vecCross( vU, vI );
      }
      else
        vU = vecCross( vR, vI );
      var ideal = [ vR, vU, vI ];
      if (pct)
      {
        var a = pct;
        var b = 1 - a;
        var o = this.view;
        var dot = o[2][0]*ideal[2][0] + o[2][1]*ideal[2][1] + o[2][2]*ideal[2][2];
        if (dot < -0.999)
        {
          this.rotate( 2, 0.07 );
          o = this.view;
        }
        var pX = [a*ideal[0][0]+b*o[0][0],a*ideal[0][1]+b*o[0][1],a*ideal[0][2]+b*o[0][2]];
        var rX = normalize( pX );
        var pY = [a*ideal[1][0]+b*o[1][0],a*ideal[1][1]+b*o[1][1],a*ideal[1][2]+b*o[1][2]];
        var pZ = vecCross( pY, pX );
        normalize( pZ );
        pY = vecCross( pX, pZ );
        this.view = [ pX, pY, pZ ];
        return dot;
      }
      else
        this.view = ideal;
    },
    
    turnToward: function( target )
    {
      clearInterval( this._turning );
      var run = 0;
      var dot = 0;
      var tmr = setInterval( function(){
        dot = viewer.pointToward( target, (dot < -0.8  ||  dot > 0.8) ? 0.15 : 0.1 );
        run ++;
        if (run >= 100  ||  dot > 0.996)
          clearInterval( tmr );
      }, 20 );
      this._turning = tmr;
    },
    _turning: 0
    
  };
  
  function vecSub( u, v )
  {
    return [ u[0]-v[0], u[1]-v[1], u[2]-v[2] ];
  }
  function vecLength( v )
  {
    return Math.sqrt( v[0]*v[0] + v[1]*v[1] + v[2]*v[2] );
  }
  function normalize( v )
  {
    var d = vecLength( v );
    v[0] /= d;
    v[1] /= d;
    v[2] /= d;
    return d;
  }
  function vecCross( u, v )
  {
    return [ u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0] ];
  }
  
  function toPolarHuman( x, y, z )
  {
    var v = [x,y,z];
    var r = normalize( v );
    if (r == 0)
      return null;
    var a = Math.atan2( v[1], v[0] ) / d2r;
    var b = Math.asin( v[2] ) / d2r;
    if (a < 0)
      a += 360;
    a /= 15;
    var h = Math.floor( a );
    a = (a-h)*60;
    var m = Math.floor( a );
    var sB = (b >= 0) ? "N" : "S";
    if (sB == "S")
      b = -b;
    var bD = Math.floor( b );
    var bM = Math.floor( (b - bD) * 60 );
    var out =
    [
      h + "h" + Math.floor(m/10) + m%10 + "m",
      bD + sB + Math.floor(bM/10) + bM%10
    ];
    return out;
  }
  
  viewer.setMode( "stars" );
  resize();
  $(window).resize( resize );

  var tDraw = setInterval( function() {
    drawFrame();
  }, 50 );
  var tTick = setInterval( function() {
    viewer.tick()
  }, 10 );
    
  function key( keysdown, mult )
  {
    var fast = keysdown.k18; // alt
    var spin = keysdown.k16; // shift
    var base = viewer.speedMultiplier;
    var s = fast ? base*15 : base;
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
      key( keysdown, 0.08 );
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
    case "0".charCodeAt(0): // go home ('0')
      viewer.center = clone( center0 );
      viewer.view = clone( view0 );
      viewer.velocity = [0,0,0];
      break;
    case "H".charCodeAt(0): // move toward home
      var t = [0,0,0];
      var c = viewer.center;
      var d = vecSub( t, c );
      var r = normalize( d );
      var mag = (r < 10) ? viewer.speedMultiplier : viewer.speedMultiplier * 10;
      if (r > 100)
        mag *= 10;
      if (r < 1)
        mag *= 0.1;
      mag *= 0.03;
      viewer.velocity[0] += d[0] * mag;
      viewer.velocity[1] += d[1] * mag;
      viewer.velocity[2] += d[2] * mag;
      break;
    case "I".charCodeAt(0): // point toward home
      // vZ = vector toward home
      viewer.turnToward( [0,0,0] );
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
  $(".zoom").toggleButton( ["far","close"], function(mode){
    if (mode == "far")
      viewer.zoom = 500;
    else if (mode == "close")
      viewer.zoom = 1000;
  });
  $(".radii").toggleButton( ["large","small"], function(mode){
    if (mode == "small")
      viewer.objectRadiusMult = 0.012;
    else if (mode == "large")
      viewer.objectRadiusMult = 0.02;
  });
  $(".mode").toggleButton( ["stars","galaxies","clusters"], function(mode){
    viewer.setMode( mode );
  });
  $(".isometric").toggleButton( ["off","on"], function(mode){
    viewer.isometric = (mode == "on");
  });
  $(".coords").toggleButton( ["off","on"], function(mode){
    if (mode == "fine")
      viewer.showCoords = 3.75;
    else if (mode == "on")
      viewer.showCoords = 7.5;
    else
      viewer.showCoords = 0;
  });
  $(".search").click( function(){
    viewer.searchValue = prompt( "Search for:" );
    $(this).text( "search" + (viewer.searchValue?":"+viewer.searchValue:"") );
    if (viewer.searchValue  &&  viewer.searchCenter)
      viewer.turnToward( viewer.searchCenter );
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
  // support two-finger gestures: rotate Hz/Vt
  $(document.body).on('mousewheel', function(evt) {
    viewer.spin( 2, -evt.deltaX/2000 );
    viewer.spin( 1, evt.deltaY/2000 );
  });
});
//TODO smooth run back to '0'
//TODO galaxy clusters seem suspicious - can't see voids, etc., compare to galaxies
//TODO page resize
