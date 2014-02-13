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
  var frameRate = 10;

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
      var c = viewer.center;
      var d = Math.sqrt( (pt[0]-c[0])*(pt[0]-c[0]) + (pt[1]-c[1])*(pt[1]-c[1]) + (pt[2]-c[2])*(pt[2]-c[2]));
      if (viewer.mode == "stars"  &&  d < 3  &&  o.planets)
      {
        // close, and centered - go to planet mode
        viewer.setMode( "planets", o );
        ($(".mode").data("changeValue"))( 0 );
      }
      else
        viewer.turnToward( pt );
    });
  }
  function drawFrame()
  {
    var t0 = new Date().getTime();
    viewer.draw( altCtx );
    ctx.drawImage( altCanvas[0], 0, 0 );
    var tE = (new Date().getTime() - t0)/1000;
    frameRate = frameRate * 0.94 + tE * 0.06;
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
  
  // correlate exoplanets to parent stars
  function correlateExoplanets( exoplanets, stars )
  {
    var t0 = new Date().getTime();
    var mFound = 0;
    var dMin = Math.cos( 0.021*d2r );
    for (var n=0; n < exoplanets.length; n++)
    {
      var pl = exoplanets[n];
      var pl0, plR;
      if (pl.sPos)
      {
        pl0 = [ pl.sPos[0], pl.sPos[1], pl.sPos[2] ];
        plR = normalize( pl0 );
      }
      else
      {
        var cb = Math.cos( pl.sPolar.b );
        pl0 =
        [
          Math.cos( pl.sPolar.a ) * cb,
          Math.sin( pl.sPolar.a ) * cb,
          Math.sin( pl.sPolar.b )
        ];
      }
      var q = [ pl0[0] > 0, pl0[1] > 0, pl0[2] > 0 ];
      var best = null;
      var dBest = 0;
      for (var nS=0; nS < stars.length; nS++)
      {
        var s = stars[nS];
        if (q[2] != (s.z > 0))
          continue;
        if (q[1] != (s.y > 0))
          continue;
        if (q[0] != (s.x > 0))
          continue;
        var s0 = [s.x,s.y,s.z];
        var sR = normalize( s0 );
        var d = pl0[0]*s0[0] + pl0[1]*s0[1] + pl0[2]*s0[2];
        if (d < dMin)
          continue;
        if (plR)
        {
          var dr = Math.abs( plR - sR ) / Math.max( plR, sR );
          if (dr > 0.4)
            continue;
        }
        if (! best  ||  d >= dBest)
        {
          // same distance?  take brightest star at the location
          //TODO mark 2nd star as binary companion
          if (best  &&  d == dBest)
          {
            if (s.M < best.M)
              continue;
          }
          best = s;
          dBest = d;
        }
      }
      if (! best)
      {
        // no distance - skip this one
        if (pl.sPolar)
          continue;
        // synthesize the star
        best =
        {
          name: pl.sName,
          x: pl.sPos[0],
          y: pl.sPos[1],
          z: pl.sPos[2],
          M: 5 // assume it's pretty dim, since it's not in our catalog
        };
        stars.push( best );
      }
      pl.star = best;
      best.radius = pl.sR;
      if (! best.name  ||  best.name.indexOf( pl.sName ) == -1)
      {
        if (best.name)
          best.name += " (" + pl.sName + ")";
        else
          best.name = pl.sName;
      }
      if (! best.planets)
        best.planets = [];
      best.planets.push( pl );
      mFound ++;
    }
    var tE = (new Date().getTime() - t0)/1000;
    console.log( "correlation took " + tE );
    //console.log( "found stars for " + mFound + " out of " + exoplanets.length );
  }
  
  /*
  {
    // eliminate some stars
    console.log( "nStars = " + stars.length );
    for (var n=0; n < stars.length; n++)
    {
      var s = stars[n];
      if (s.planets)
        continue;
      var d = normalize([s.x,s.y,s.z]);
      if (d < 100)
        continue;
      if (s.M > 2)
      {
        stars.splice( n, 1 );
        n --;
      }
    }
    console.log( "nStars = " + stars.length );
  }
  */
  
  // patch up object lists
  galaxies.push({ x: 0, y: 0, z: 0, name: "Milky Way", home: true });
  var sol = { x: 0, y: 0, z: 0, M: 4.83, name: "Sol", home: true, planets: [{},{},{}] };
  stars.push( sol );
  if (typeof galaxyClusters == "undefined")
    galaxyClusters = [{ x:0, y:0, z:0 }];
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
    var brMax = 500;
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
    showExo: 0,
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
    mode: "",
    searchValue: null,
    searchHits: 0,
    searchCenter: null,
    // saved settings for each mode
    savedPerMode: {},
    
    /**
     * Choose which scale we're viewing.
     */
    setMode: function( mode, starForPlanets )
    {
      var oldMode = this.mode;
      // save viewpoint for old mode
      var save = this.savedPerMode[ oldMode ];
      if (! save)
        save = (this.savedPerMode[ oldMode ] = {});
      save.c = clone( this.center );
      save.v = clone( this.view );
      if (mode == "clusters")
      {
        this.objectList = galaxyClusters;
        this.objectRadius = 8;
        this.zoom = 200;
        this.speedMultiplier = 10;
        this.limitDistance = 1500;
        this.fuzzy = true;
      }
      else if (mode == "galaxies")
      {
        this.objectList = galaxies;
        this.objectRadius = 0.2;
        this.zoom = 400;
        this.speedMultiplier = 1;
        this.limitDistance = 1500;
        this.fuzzy = true;
      }
      else if (mode == "stars")
      {
        this.objectList = stars;
        this.objectRadius = 1;
        this.zoom = 400;
        this.speedMultiplier = 4;
        this.limitDistance = 1000;
        this.fuzzy = false;
      }
      else if (mode == "planets")
      {
        if (starForPlanets)
          planetsControl.setStar( starForPlanets );
        else
        {
          var best;
          var dBest;
          var c = this.center;
          for (var n=0; n < stars.length; n++)
          {
            var s = stars[n];
            if (! s.planets)
              continue;
            var dx = s.x - c[0];
            if (dx > 10)
              continue;
            var dy = s.y - c[1];
            if (dy > 10)
              continue;
            var d = dx*dx + dy*dy + (s.z-c[2])*(s.z-c[2]);
            if (! best  ||  d < dBest)
            {
              best = s;
              dBest = d;
            }
          }
          if (best)
            planetsControl.setStar( best );
        }
        this.objectList = planets;
        this.objectRadius = 1;
        this.zoom = 400;
        this.speedMultiplier = 4;
        this.limitDistance = 50000; // in au
        this.fuzzy = false;
        this.searchValue = "";
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
      //HACK default center should also be part of the viewer
      center0 = (mode=="planets") ? [0,-2,1.0] : [0,-0.1,0];
      view0 = (mode=="planets") ? [[1,0,0],[0,0.291647,0.956526],[0,0.966526,-0.291647]] : [[1,0,0],[0,0,1],[0,1,0]];
      this.mode = mode;
      // reset position when changing coordinates
      function type(m)
      {
        if (m == "clusters"  ||  m == "galaxies")
          return "g";
        else
          return m;
      }
      if (oldMode == "planets"  &&  mode != "planets")
        planetsControl.pause( true );
      if (oldMode != "planets"  &&  mode == "planets")
        planetsControl.pause( false );
      var restore = this.savedPerMode[ mode ];
      if (restore)
      {
        this.center = clone( restore.c );
        this.view = clone( restore.v );
      }
      else
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
      //if (this.isometric)
      //  imposeLimit = false;
      var c = this.center;
      var v = this.view;
      var zoom = this.zoom;
      var dx = x - c[0];
      var dy = y - c[1];
      var dz = z - c[2];
      var v2 = v[2];
      var vz = dx * v2[0] + dy * v2[1] + dz * v2[2];
      if (vz <= 0)
        return null;
      if (imposeLimit  &&  vz > this.limitDistance)
        return null;
      var v0 = v[0], v1 = v[1];
      var vx = dx * v0[0] + dy * v0[1] + dz * v0[2];
      var vy = dx * v1[0] + dy * v1[1] + dz * v1[2];
      var fz = /*this.isometric ? zoom / this.isometricZ :*/ zoom / vz;
      var sx = vx * fz;
      var sy = vy * fz;
      if (Math.abs(sx) > 3000  ||  Math.abs(sy) > 3000)
        return null;
      sx += canvasWidth/2;
      sy = canvasHeight/2 - sy;
      return [sx,sy,/*this.isometric?this.isometricZ :*/ vz];
    },
    draw: function( ctx )
    {
      var order = [];
      var oo = this.objectList;
      for (var n=0; n < oo.length; n++)
        order[n] = n;
      if (typeof planets != "undefined"  &&  this.objectList === planets)
      {
        var nMax = 10;
        // sort the first few objects, back to front
        for (var n=0; n < oo.length  &&  n < nMax; n++)
        {
          var obj = oo[n];
          var s = this.toScreenCoords( obj.x, obj.y, obj.z );
          obj.dTmp = s ? s[2] : 10000;
        }
        for (var n1=0; n1 < nMax; n1++)
          for (var n2=n1+1; n2 < nMax; n2++)
            if (oo[order[n1]].dTmp < oo[order[n2]].dTmp)
            {
              var t = order[n1];
              order[n1] = order[n2];
              order[n2] = t;
            }
      }
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
      var rMin = (this.mode == "galaxies") ? 0 : 0.30;
      for (var nObj=0; nObj < this.objectList.length; nObj++)
      {
        var nG = order[ nObj ];
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
        if (r < rMin)
          if (! match)
            if (! this.showExo  ||  ! galaxy.planets)
              continue;
        if (r > 3000)
          continue;
        var rp = r + 4;
        if (s[0] - rp > canvasWidth  ||  s[0] + rp < 0)
          continue;
        if (s[1] - rp > canvasHeight  ||  s[1] + rp < 0)
          continue;
        var mag = gMag / Math.sqrt(s[2]);
        if (mag > 0.7)
          mag = 0.7;
        if (mag < 0.3)
          mag = 0.3;
        if (galaxy.home  &&  mag < 0.5)
          mag = 0.5;
        var fadeClose = 1;
        if (r > 40)
          fadeClose = Math.sqrt(40)/Math.sqrt(r) - 0.08;
        if (fadeClose < 0.04)
          continue;
        if (galaxy.alpha)
          ctx.globalAlpha = galaxy.alpha;
        else
          ctx.globalAlpha = mag * fadeClose;
        var fill;
        if (galaxy.home)
          fill = this.homeColor;
        else if (galaxy.color)
          fill = galaxy.color;
        else
          fill = this.objectColor;
        ctx.fillStyle = fill;
        if (r <= 0.75)
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
        // stars with exoplanets
        if (this.showExo  &&  galaxy.planets  &&  galaxy.planets.length >= this.showExo)
        {
          ctx.strokeStyle = "#00ffc0";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc( s[0], s[1], r+4, 0, 6.2832, false );
          ctx.closePath();
          ctx.stroke();
        }
        if (match)
        {
          ctx.strokeStyle = "#80c0ff";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc( s[0], s[1], r+3, 0, 6.2832, false );
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
      $(".status").append( "<br/><em class='frameRate'>frame rate: " + (1/frameRate).toFixed(1) + "</em>" );
      if (this.highlightObject)
      {
        var unit1, unit2, u2mult = 3.26163344;
        if (this.mode == "planets")
        {
          unit1 = "au";
          unit2 = "lm";
          u2mult = 8.3167464;
        }
        else if (this.mode == "stars")
        {
          unit1 = "pc";
          unit2 = "ly";
        }
        else
        {
          unit1 = "Mpc";
          unit1 = "Mly";
        }
        var g = this.highlightObject;
        var d = Math.sqrt( g.x*g.x+g.y*g.y+g.z*g.z );
        var dly = d*u2mult;
        var dI = Math.sqrt( (c[0]-g.x)*(c[0]-g.x)+(c[1]-g.y)*(c[1]-g.y)+(c[2]-g.z)*(c[2]-g.z) );
        var dIly = dI*u2mult;
        var cat = $("<p/>");
        cat.append( "highlighted: " + (g.name?g.name:"") );
        cat.append( "<li>xyz: (" + g.x.toFixed(2) + "," + g.y.toFixed(2) + "," + g.z.toFixed(2) + ")</li>" );
        if (this.mode == "stars")
        {
          var polar = toPolarHuman( g.x, g.y, g.z );
          if (polar)
            cat.append( "<li>ra/decl from Sol: " + polar[0] + ", " + polar[1] + "</li>" );
        }
        cat.append( "<li>dist. from Sol: " + d.toFixed(1) + unit1 + " (" + dly.toFixed(1) + unit2 + ")" + "</li>" );
        cat.append( "<li>dist. from you: " + dI.toFixed(1) + unit1 + " (" + dIly.toFixed(1) + unit2 + ")" + "</li>" );
        if (g.M)
          cat.append( "<li title='absolute magnitude'>abs mag (M): " + g.M.toFixed(2) + "</li>" );
        if (g.radius)
          cat.append( "<li title='radius'>radius: : " + (g.radius/109.2).toFixed(2) + " solar radii</li>" );
        if (g.planets)
          cat.append( "<li title=''>" + g.planets.length + " planet" + ((g.planets.length==1)?"":"s") + "</li>" );
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
            ctx.strokeStyle = "#005000";
            ctx.beginPath();
            ctx.moveTo( p[0], p[1] );
            ctx.lineTo( s[0], s[1] );
            ctx.stroke();
          }
          if (s0  &&  s)
          {
            ctx.lineWidth = (lng % 30 == 0) ? 2 : 1;
            ctx.globalAlpha = (lng % 30 == 0) ? 0.5 : 0.3;
            ctx.strokeStyle = "#005000";
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
        if (run >= 120  ||  dot > 0.998)
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
  
  planetsControl.setStar( sol );
  viewer.setMode( "planets" );
  resize();
  $(window).resize( resize );

  var tDraw = setInterval( function() {
    drawFrame();
  }, 25 );
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
      if (viewer.mode == "galaxies")
        r *= 10;
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
    case 27:  // escape - exit planet mode
      if (viewer.mode == "planets")
      {
        viewer.setMode( "stars" );
        ($(".mode").data("changeValue"))( 1 );
      }
      break;
    }
    return false;
  });

  /**
   * Set up a button to toggle through a list of values.
   */
  $.fn.toggleButton = function( names, onChanged, initial )
  {
    var btn = this;
    if (! initial)
      initial = 0;
    function changeValue( nCurrent )
    {
      btn.data( "index", nCurrent );
      var newValue = names[ nCurrent ];
      var prev = "", next = "";
      if (nCurrent + 1 < names.length)
      {
        var nextValue = names[ (nCurrent + 1) % names.length ];
        next = "<span class='tb-next'> &gt;&gt; " + nextValue + "</span>";
      }
      if (nCurrent > 0)
      {
        var prevValue = names[ (nCurrent + names.length - 1) % names.length ];
        prev = "<span class='tb-prev'>" + prevValue + " &lt;&lt; </span>";
      }
      btn.html( prev + newValue + next );
    }
    btn.data( "changeValue", function(n){
      changeValue( n );
    });
    btn.addClass( ".toggleButton" );
    btn.click(function(evt){
      var nCurrent = btn.data( "index" );
      if ($(evt.target).hasClass("tb-prev"))
        nCurrent = (nCurrent + names.length - 1) % names.length;
      else
        nCurrent = (nCurrent + 1) % names.length;
      changeValue( nCurrent );
      onChanged( names[ nCurrent ] );
    });
    // set initial value
    changeValue( initial );
    onChanged( names[initial] );
  };
  $(".zoom").toggleButton( ["close","far"], function(mode){
    if (mode == "far")
      viewer.zoom = 500;
    else if (mode == "close")
      viewer.zoom = 1000;
  }, 1);
  $(".radii").toggleButton( ["small","large"], function(mode){
    if (mode == "small")
      viewer.objectRadiusMult = 0.012;
    else if (mode == "large")
      viewer.objectRadiusMult = 0.02;
  }, 1);
  $(".mode").toggleButton( ["planets","stars","galaxies"/*,"clusters"*/], function(mode){
    viewer.setMode( mode );
  });
  $(".timeControl").toggleButton( ["pause","1d/s","1w/s","1mo/s","3mo/s"], function(v){
    var scale = 1;
    if (v == "3mo/s")
      scale = 86400*30*3;
    else if (v == "1mo/s")
      scale = 86400*30;
    else if (v == "1w/s")
      scale = 86400*7;
    else if (v == "1d/s")
      scale = 86400;
    else if (v == "pause")
      scale = 0;
    planetsControl.setTimeScale( scale );
  }, 2);
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
  $(".showExo").toggleButton( ["off","1+","2+"], function(mode){
    if (mode == "1+")
      viewer.showExo = 1;
    else if (mode == "2+")
      viewer.showExo = 2;
    else
      viewer.showExo = 0;
  });
  $(".search").click( function(){
    viewer.searchValue = prompt( "Search for:" );
    $(this).text( "search" + (viewer.searchValue?":"+viewer.searchValue:"") );
    setTimeout( function(){
      if (viewer.searchValue  &&  viewer.searchCenter)
        viewer.turnToward( viewer.searchCenter );
    }, 250 );
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
      panel.addClass( "minimized" );
    }
    else
    {
      body.slideDown();
      $(this).text("-");
      panel.removeClass( "minimized" );
    }
  });
  // support two-finger gestures: rotate Hz/Vt
  $(document.body).on('mousewheel', function(evt) {
    viewer.spin( 2, -evt.deltaX/2000 );
    viewer.spin( 1, evt.deltaY/2000 );
  });

  function showMessage( msg )
  {
    var w = $("#message");
    if (msg)
    {
      w.html( msg );
      w.show();
    }
    else
      w.hide();
  }

  showMessage( "<br/>Loading..." );
  setTimeout( function(){
    correlateExoplanets( exoplanets, stars );
    showMessage();
  }, 100 );
  
});
//TODO show more exoplanet metadata
//TODO startup too slow - correspond stars with planets more quickly or do this offline
//TODO planet artwork
//TODO galaxy artwork
//TODO twist gesture to rotate around Y axis
//TODO galaxy clusters are incomplete - maybe that's just the way NED is?
//TODO constellation lines?
