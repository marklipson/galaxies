import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static java.lang.Math.*;

/**
 * Try this next!
 *   http://www.sdss3.org/dr10/
 */
public class EDD_Galaxies
{
  static final File base = new File( "/Users/marklipson/Desktop/galaxies-stuff/" );
  static final double d2r = PI / 180;

  /**
   * Convert 'z' (% of speed of light redshift) to megaparsecs.
   * 
   * http://m.teachastronomy.com/astropedia/article/Relating-Redshift-and-Distance
   * 
   * d = z c / H0
   */
  private static double z_to_Mpc( double z )
  {
    final double H0 = 73.0;
    final double c = 299792.458;
    return z * c / H0;
  }
  
  private static String jsonVal( String name, String value )
  {
    return jsonVal( true, name, value );
  }
  private static String jsonVal( String name, double value, int prec )
  {
    return jsonVal( true, name, value, prec );
  }
  private static String jsonVal( String name, boolean value )
  {
    return jsonVal( true, name, value );
  }
  private static String jsonVal( boolean comma, String name, String value )
  {
    if (value != null)
      return (comma?",":"") + name + ":\"" + value.replace("\\","\\\\").replace("\"", "\\\"") + "\"";
    else
      return "";
  }
  private static String jsonVal( boolean comma, String name, double value, int prec )
  {
    return (comma?",":"") + name + ":" + String.format( "%." + prec + "f", value );
  }
  private static String jsonVal( boolean comma, String name, boolean value )
  {
    return (comma?",":"") + name + ":" + value;
  }

  /**
   * Exoplanet data...
   * 
   * http://exoplanets.org/table
   * 
   * NAME,MSINI,A,PER,ECC,OM,T0,STAR,RSTAR,R,DIST,RA,DEC,BINARY,BINARYURL,BINARYREF
   * ,mjupiter,au,day,,deg,jd,,rsun,rjupiter,pc,hr,deg,,,
   */
  public static void process_EXO_data() throws Exception
  {
    File input = new File( base, "exoplanets.csv" );
    File output = new File( input.getParentFile(), "exoplanets.js" );
    BufferedReader r = new BufferedReader( new FileReader( input ) );
    FileWriter w = new FileWriter( output );
    String line;
    w.write( "// Source: http://exoplanets.org/table\n" );
    w.write( "var exoplanets = [\n" );
    while ((line = r.readLine()) != null)
    {
      String cols[] = line.split( "\\s*,\\s*" );
      int n = 0;
      String name = cols[n++];
      // this one is a duplicate
      if (name.equals( "HD 62509 b" ))
        continue;
      String msini = cols[n++];
      String a = cols[n++];
      if (! a.matches( "[0-9\\.]+" ))
        continue;
      String per = cols[n++];
      String ecc = cols[n++];
      String om = cols[n++];
      String t0 = cols[n++];
      String star = cols[n++];
      String rstar = cols[n++];
      String rad = cols[n++];
      String dist = cols[n++];
      String ra = cols[n++];
      String dec = cols[n++];
      String binary = cols[n++];
      String row = "{";
      // planet's name
      row += jsonVal( false, "pName", name );
      // planet's radius
      double pR;
      if (rad.matches( "[0-9\\.]+" ))
        // given in Jupiter radii
        pR = Double.valueOf( rad );
      else if (msini.matches( "[0-9\\.]+" ))
        // "given" as a proportion of jupiter's mass
        pR = Math.pow( Double.valueOf( msini ) * 1.15, 0.3333 );
      else
        continue;
      pR *= 11.209; // convert to earth radii
      row += jsonVal( "pR", pR, 2 );
      // associated star
      // - radius (given in sun radii - convert to earth radii)
      if (! rstar.isEmpty())
        row += jsonVal( "sR", Double.valueOf(rstar)*109.2, 2 );
      // - name
      row += jsonVal( "sName", star );
      row += jsonVal( "sBinary", binary.equals("1") );
      // TODO information about binary star orbit, i.e. distance between stars, orbital period and eccentricity
      // - position
      double _a = Double.valueOf(ra)*15 * d2r;
      double _b = Double.valueOf(dec) * d2r;
      if (dist.isEmpty())
      {
        row += String.format(",sPolar:{a:%.5f,b:%.5f}", _a, _b );
      }
      else
      {
        double sD = Double.valueOf(dist);
        double x = cos(_a) * cos(_b) * sD;
        double y = sin(_a) * cos(_b) * sD;
        double z =           sin(_b) * sD;
        row += String.format(",sPos:[%.5f,%.5f,%.5f]", x, y, z );
      }
      // orbital elements
      row += jsonVal( "oeA", Double.valueOf(a), 3 );     // (au)
      row += jsonVal( "oePeriod", Double.valueOf(per), 3 ); // (days)
      if (! ecc.isEmpty())
        row += jsonVal( "oeE", Double.valueOf(ecc), 3 );
      if (! om.isEmpty())
        row += jsonVal( "oePeri", Double.valueOf(om), 3 ); // from angle node to peri
      if (! t0.isEmpty())
        row += jsonVal( "oeT0", Double.valueOf(t0), 3 );   // time at peri
      row += "},\n";
      w.write( row );
    }
    w.write( "];\n" );
    r.close();
    w.close();
  }
  
  /**
   * Star data...
   * 
   * http://www.astronexus.com/node/34
   * 
   * StarID,Hip,HD,HR,Gliese,BayerFlamsteed,ProperName,RA,Dec,Distance,Mag,AbsMag,Spectrum,ColorIndex
   * 1,     2,224690, , ,,,0.00025315,-19.49883745,45.662100456621, 9.27,5.97222057420059,K3V         , 0.999
   *
   */
  public static void process_HYG_data() throws Exception
  {
    File input = new File( base, "star-catalog-hygfull.csv" );
    File output = new File( input.getParentFile(), "stars.js" );
    BufferedReader r = new BufferedReader( new FileReader( input ) );
    FileWriter w = new FileWriter( output );
    String line;
    w.write( "// Source: http://www.astronexus.com/node/34\n" );
    w.write( "// positions are in equatorial coordinates, units are megaparsecs\n" );
    w.write( "var stars = [\n" );
    while ((line = r.readLine()) != null)
    {
      String cols[] = line.split( "\\s*,\\s*" );
      if (! cols[0].matches( "[0-9]+" ))
        continue;
      String name = cols[6];  // proper name
      String name2 = cols[5]; // bayer flamstead catalog
      String name3 = cols[4]; // gliese catalog
      String name4 = cols[2]; // HD
      if (! name2.isEmpty())
        name += (name.isEmpty()?"":", ") + name2;
      if (! name3.isEmpty())
        name += (name.isEmpty()?"":", ") + name3;
      if (! name4.isEmpty())
        name += (name.isEmpty()?"":", ") + "HD " + name4;
      double ra = Double.parseDouble( cols[7] )*15 * d2r;
      double decl = Double.parseDouble( cols[8] ) * d2r;
      //if (name.contains("Rigel"))
      //  System.out.println( "Rigel: " + ra/d2r + ", " + decl/d2r );
      double D = Double.parseDouble( cols[9] );
      double absMag = Double.parseDouble( cols[11] );
      String spectrum = (cols.length <= 12) ? "" : cols[12];
      // eliminate a few
      // at great distance the distances are very rough estimates
      if (D > 20000)
        continue;
      if (name.isEmpty())
      {
        /*
        // unnamed, far away, really dim
        if (D > 200  &&  absMag > 3)
          continue;
        if (D > 300  &&  absMag > 2)
          continue;
        */
      }
      double x = cos(ra) * cos(decl) * D;
      double y = sin(ra) * cos(decl) * D;
      double z =           sin(decl) * D;
      String extra = "";
      if (! name.isEmpty())
        extra = ",name:'" + name.replace("'","\\'") + "'";
      if (! spectrum.isEmpty())
        extra += ",s:'" + spectrum.substring( 0, 1 ).toUpperCase() + "'";
      extra += ",M:" + String.format( "%.1f", absMag );
      w.write( String.format( "{x:%.3f,y:%.3f,z:%.3f" + extra + "},\n", x, y, z ) );
    }
    w.write( "];\n" );
    r.close();
    w.close();
  }

  /**
   * Nearby galaxy data from:
   *   http://edd.ifa.hawaii.edu/dfirst.php?
   *   
   *  0   1   2   3 4 5 6 7 8 91011 12  13  14   15
   * pgc|Dist|DM|eD|C|T|L|M|S|N|H|F|RAJ|DeJ|Glon|Glat|SGL|SGB|Ty|Asfd|Btot|Ks|Vhel|V...
   * ---|Mpc|mag||||||||||hms|damas|deg|deg|deg|deg||mag|mag|mag|km/s|km/s|km/s|km/s...
   */
  public static void process_EDD_data() throws Exception
  {
    File input = new File( base, "galaxy-database.csv" );
    File output = new File( input.getParentFile(), "galaxy-database-xyz.js" );
    BufferedReader r = new BufferedReader( new FileReader( input ) );
    FileWriter w = new FileWriter( output );
    String line;
    w.write( "// Source: http://edd.ifa.hawaii.edu/index.html\n" );
    w.write( "// positions are in megaparsecs, in galactic coordinates\n" );
    w.write( "var galaxies = [\n" );
    while ((line = r.readLine()) != null)
    {
      String cols[] = line.split( "\\|" );
      if (! cols[1].matches( "[0-9\\.]+" ))
        continue;
      double D = Double.parseDouble( cols[1] );
      //double gLon = Double.parseDouble( cols[14] ) * d2r;
      //double gLat = Double.parseDouble( cols[15] ) * d2r;
      double gLon = parseRA( cols[12] ) * d2r;
      double gLat = parseDecl( cols[13] ) * d2r;
      String strM = cols[7];
      //double M = strM.isEmpty() ? Double.NaN : Double.parseDouble( strM );
      String name = cols[27];
      String cluster = (cols.length <= 48) ? null : cols[48];
      double x = cos(gLon) * cos(gLat) * D;
      double y = sin(gLon) * cos(gLat) * D;
      double z =             sin(gLat) * D;
      String nameJSON = "";
      if (! name.isEmpty())
        nameJSON = ",name:'" + name + "'";
      else if (cluster != null  &&  ! cluster.isEmpty())
        nameJSON = ",name:'cluster: " + cluster + "'";
      w.write( String.format( "{x:%.2f,y:%.2f,z:%.2f" + nameJSON + "},\n", x, y, z ) );
    }
    w.write( "];\n" );
    r.close();
    w.close();
  }
  
  /**
   * http://ned.ipac.caltech.edu
   *   
   * No.|Object Name|RA(deg)|DEC(deg)|Type|Velocity|Redshift|Redshift Flag|Magnitude and Filter|Distance (arcmin)|References|Notes|Photometry Points|Positions|Redshift Points|Diameter Points|Associations
   * 1|NSCS J000001+051909|  0.00417 |   5.31917 |GClstr| 56961| 0.190000 |EST |     |  0.000|1|0|0|0|0|0|0
   */
  public static void process_NED_data() throws Exception
  {
    File input = new File( base, "ned-galactic-clusters.txt" );
    File output = new File( input.getParentFile(), "galaxy-clusters.js" );
    BufferedReader r = new BufferedReader( new FileReader( input ) );
    FileWriter w = new FileWriter( output );
    String line;
    w.write( "// Source: http://ned.ipac.caltech.edu/services/nbasq/\n" );
    w.write( "// positions are in megaparsecs, in galactic coordinates\n" );
    w.write( "var galaxyClusters = [\n" );
    int count = 0;
    while ((line = r.readLine()) != null)
    {
      String cols[] = line.split( "\\|" );
      if (! cols[0].matches( "[0-9]+" ))
        continue;
      double redshift = Double.parseDouble( cols[6] );
      double gLon = Double.parseDouble( cols[2] ) * d2r;
      double gLat = Double.parseDouble( cols[3] ) * d2r;
      String name = cols[1];
      double D = z_to_Mpc( redshift );
      if (D > 1400)
        continue;
      count ++;
      double x = cos(gLon) * cos(gLat) * D;
      double y = sin(gLon) * cos(gLat) * D;
      double z =             sin(gLat) * D;
      String nameJSON = "";
// works but file is very large
//      if (! name.isEmpty())
//        nameJSON = ",name:'" + name + "'";
      w.write( String.format( "{x:%.2f,y:%.2f,z:%.2f" + nameJSON + "},\n", x, y, z ) );
    }
    w.write( "];\n" );
    r.close();
    w.close();
    System.out.println( count );
  }

  final static Pattern ptnRA = Pattern.compile( "(\\d\\d)(\\d\\d)(\\d\\d\\.\\d+)" );
  final static Pattern ptnDecl = Pattern.compile( "([\\+\\-])(\\d\\d)(\\d\\d)(\\d\\d\\.\\d+)" );
  public static double parseRA( String hhmmss )
  {
    Matcher m = ptnRA.matcher( hhmmss );
    if (! m.find())
      return Double.NaN;
    double hh = Integer.valueOf( m.group(1) );
    double mm = Integer.valueOf( m.group(2) );
    double ss = Double.valueOf( m.group(3) );
    return (hh + mm/60 + ss/3600)*15;
  }
  public static double parseDecl( String ddmmss )
  {
    Matcher m = ptnDecl.matcher( ddmmss );
    if (! m.find())
      return Double.NaN;
    int sign = m.group(1).equals( "+" ) ? 1 : -1;
    double dd = Integer.valueOf( m.group(2) );
    double mm = Integer.valueOf( m.group(3) );
    double ss = Double.valueOf( m.group(4) );
    return sign * (dd + mm/60 + ss/3600);
  }
  
  public static void main( String[] args )
  {
    try
    {
      //process_EXO_data();
      process_EDD_data();
      //process_NED_data();
      //process_HYG_data();
    }
    catch( Exception x )
    {
      x.printStackTrace( System.err );
    }
  }

}
