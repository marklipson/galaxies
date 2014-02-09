(function(){
  
  /**
   * Usage:
   *   planets[0].name            ==>  e.g. "jupiter"
   *   planets[0].position( t )   ==> [x,y,z]
   */
  
  // multiply by this to convert degrees to radians
  var d2r = Math.PI / 180;
  // orbital elements are relative to this time
  var refFrame = 2415020;
  // earth radius, miles
  var rEarth = 3959;
  // list of planets
  var planets = [];

  function Planet( name, misc, r, a, e, p, dp, n, dn, i, di, l, dl )
  {
    this.name = name;
    this.radius = misc.radius;
    this.color = misc.color;
    this.r = r;
    this.a = a;
    this.e = e;
    this.p = p;
    this.n = n;
    this.i = i;
    this.l = l;
    this.dP = dp;
    this.dN = dn;
    this.dI = di;
    this.dL = dl;
  }
  Planet.prototype =
  {
    /**
     * Calculate heliocentric rectangular coordinates for a given time.
     *
     * To convert jsTime to JD:
     *   tJD = t / 86400000 + 2440587.5
     */
    position: function( tJD )
    {
      // convert time to julian centuries (the orbital elements use this time frame)
      var t = (tJD - refFrame) / 36525;
      // get elements
      var p = (this.p + this.dP * t) % 6.2831852;
      var n = (this.n + this.dN * t) % 6.2831852;
      var i = this.i + this.dI * t;
      var M = (this.l + this.dL * t) % 6.2831852;
      var e = this.e;
      var a = this.a;
      // adjust elements to the algorithm
      p -= n;
      M -= p + n;
      // Find true anomaly (v)
      var v;
      {
        var E = M;
        for (var iter=0; iter < 6; iter++)
          E = M + e * Math.sin(E);
        if (Math.cos(E/2.0) != 0.0)
          v = 2.0 * Math.atan( Math.sqrt( (1.0 + e) / (1.0 - e) ) * Math.tan( E / 2.0 ) );
        else
          v = E;
      }
      // find true distance (r)
      var r = a * ((1.0 - e*e) / (1.0 + e * Math.cos(v)));
      // find and return rectangular position
      var pos = [];
      // find offset from ascending node
      var w = p + v;
      // intermediate values
      var sinW = Math.sin( w );
      var cosW = Math.cos( w );
      var sinNode = Math.sin( n ); // was: node (not sure why dNode was being ignored)
      var cosNode = Math.cos( n );
      var cosIncl = Math.cos( i ); // was: incl (not sure why dIncl was being ignored)
      // calculate
      pos[0] = r * (cosW * cosNode  -  sinW * sinNode * cosIncl);
      pos[1] = r * (cosW * sinNode  +  sinW * cosNode * cosIncl);
      pos[2] = r * (sinW * Math.sin( i ));
      return pos;
    }
  };

  planets.push( new Planet( "Mercury", {radius:1516/rEarth, color:"#3c3837"}, 0.3824, 0.3870984, 0.205614929, 1.32465, 0.027113, 0.82283, 0.020678, 0.12223, 3.03396e-5, 3.10982, 2608.81471 ) );
  planets.push( new Planet( "Venus",   {radius:3760/rEarth, color:"#d7d4cf"}, 0.9489, 0.72333015, 0.006816361, 2.27138, 0.023951, 1.32275, 0.015953, 0.059230123, 2.18554e-5, 5.98242, 1021.352936 ) );
  planets.push( new Planet( "Earth",   {radius:1,         color:"#a5bee7"}, 1.0, 1.00000129, 0.016749801, 1.76660, 0.029922, 0, 0, 0, 0, 1.74004, 628.331955 ) );
  planets.push( new Planet( "Mars",    {radius:2106/rEarth, color:"#e8c187"}, 0.5320, 1.523678, 0.093309, 5.83321, 0.032121, 0.851488, 0.013560, 0.03229, -0.113277, 5.12674, 334.085624 ) );
  planets.push( new Planet( "Jupiter", {radius:43441/rEarth,color:"#b4a49c"}, 11.1942, 5.202561, 0.048335, 0.22202, 0.028099, 1.73561, 0.017637, 0.02284, -0.000099, 4.15474, 52.993466 ) );
  planets.push( new Planet( "Saturn",  {radius:36184/rEarth,color:"#c1b853"}, 9.4071, 9.554747, 0.05589, 1.58996, 0.034181, 1.96856, 0.015240, 0.043503, -0.000068, 4.65243, 21.354276 ) );
  planets.push( new Planet( "Uranus",  {radius:15759/rEarth,color:"#a6c1d5"}, 3.98245, 19.21814, 0.046344, 2.994088, 0.025908, 1.282417, 0.008703, 0.013482, 0.000011, 4.262050, 7.502534 ) );
  planets.push( new Planet( "Neptune", {radius:15299/rEarth,color:"#90aee0"}, 3.8099, 30.10957, 0.008997, 0.815546, 0.024864, 2.280820, 0.019180, 0.031054, -0.000167, 1.474070, 3.837733 ) );

  // starting time
  var tBase = refFrame - 36535;
  var t0 = new Date().getTime();
  var scale = 86400*30; // one month per second
  function tNow()
  {
    var t1 = new Date().getTime();
    return tBase + scale * (t1-t0)/86400000;
  }
  /**
   * Change the time scale.
   */
  function setTimeScale( newScale )
  {
    tBase = tNow();
    t0 = new Date().getTime();
    scale = newScale;
  }
  var savedScale = 0;
  function pause( v )
  {
    if (v)
    {
      savedScale = scale;
      setTimeScale( 0 );
    }
    else
    {
      setTimeScale( savedScale );
    }
  }
  window.planets_setTimeScale = setTimeScale;
  window.planets_pause = pause;

  setInterval( updatePlanets, 50 );
  updatePlanets();
  function updatePlanets()
  {
    if (window.planets  &&  scale == 0)
      return;
    var out = [];
    out.push({ name: "Sun", x: 0, y: 0, z: 0, r: 50000/rEarth/*6.955E5/rEarth*/, color: "#ffffe0", mag:10000, alpha: 1 });
    var t = tNow();
    for (var n=0; n < planets.length; n++)
    {
      var pl = planets[n];
      var pos = pl.position( t );
      out.push({ name: pl.name, x: pos[0], y: pos[1], z: pos[2], r: pl.radius, color: pl.color, mag: 100 });
    }
    if (window.planets)
    {
      for (var n=0; n < out.length; n++)
      {
        var o = window.planets[n];
        var i = out[n];
        o.x = i.x;
        o.y = i.y;
        o.z = i.z;
      }
    }
    else
    {
      var ss = window.stars;
      for (var n=0; n < ss.length; n++)
      {
        var s = ss[n];
        if (s.name == "Sol")
          continue;
        out.push({ x: s.x*100, y: s.y*100, z: s.z*100, color: s.color, r: s.r/10 });
      }
      window.planets = out;
    }
  }
})();
