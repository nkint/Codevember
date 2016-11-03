#extension GL_EXT_shader_texture_lod : enable

precision highp float;

#define NUM_STEPS 100
#define saturate(x) clamp(x, 0.0, 1.0)
#define PI 3.1415926535897932384626433832795


// Filmic tonemapping from
// http://filmicgames.com/archives/75

const float A = 0.15;
const float B = 0.50;
const float C = 0.10;
const float D = 0.20;
const float E = 0.02;
const float F = 0.30;

//	VARYING
varying vec2 uv;

//	UNIFORMS
uniform float uGlobalTime;
uniform vec2 uMouse;
uniform float uFOV;
uniform vec2 uAngles;
uniform float uRadius;

uniform samplerCube uRadianceMap;
uniform samplerCube uIrradianceMap;
uniform sampler2D 	uTextureNoise;

uniform vec3		uBaseColor;
uniform float		uRoughness;
uniform float		uMetallic;
uniform float		uSpecular;

uniform float		uExposure;
uniform float		uGamma;

vec2 rotate(vec2 pos, float angle) {
	float c = cos(angle);
	float s = sin(angle);

	return mat2(c, s, -s, c) * pos;
}

//	GEOMETRY
float sphere(vec3 pos, float radius) {
	return length(pos) - radius;
}

float box( vec3 p, vec3 b ) {
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) +
         length(max(d,0.0));
}

float box(vec3 p, float b) {
	return box(p, vec3(b));
}


vec2 repAng(vec2 p, float n) {
    float ang = 2.0*PI/n;
    float sector = floor(atan(p.x, p.y)/ang + 0.5);
    p = rotate(p, sector*ang);
    return p;
}


float repeat(float v, float gap) {
	return mod(v + gap/2.0, gap) - gap/2.0;
}

vec2 repeat(vec2 v, float gap) {
	return mod(v + gap/2.0, gap) - gap/2.0;
}

float displacement(vec3 p) {
	float noiseScale = .75;
	return sin( cos(noiseScale*p.x * 1.32459) * 0.74356)*cos(sin(noiseScale*p.y)*1.234786)*sin(noiseScale*3.12364*cos(p.z));
}

float sinusoidalBumps(in vec3 p){
	float time = uGlobalTime;
    return sin(p.x*4.+time*0.97)*cos(p.y*4.+time*2.17)*sin(p.z*4.-time*1.31) + 0.5*sin(p.x*8.+time*0.57)*cos(p.y*8.+time*2.11)*sin(p.z*8.-time*1.23);
}


const float sphereSize = 3.0;

//	MAPPING FUNCTION
vec3 map(vec3 pos) {
	float colorIndex = 0.0;
	float d = sphere(pos, sphereSize);
	float dSphere = d;


	float noise = sinusoidalBumps(pos * 0.3) * .55;

	float dBox = box(pos + vec3(0.0, sphereSize * 0.8 + noise, 0.0), vec3(sphereSize));
	d = max(d, dBox);

	colorIndex = d == dBox ? 1.0 : 0.0;


	return vec3(d, colorIndex, dSphere);
}

//	CALCULATE NORMAL
vec3 computeNormal(vec3 pos) {
	vec2 eps = vec2(0.005, 0.0);

	vec3 normal = vec3(
		map(pos + eps.xyy).x - map(pos - eps.xyy).x,
		map(pos + eps.yxy).x - map(pos - eps.yxy).x,
		map(pos + eps.yyx).x - map(pos - eps.yyx).x
	);
	return normalize(normal);
}

vec3 computeNormalGlass(vec3 pos) {
	vec2 eps = vec2(0.005, 0.0);

	vec3 normal = vec3(
		map(pos + eps.xyy).z - map(pos - eps.xyy).z,
		map(pos + eps.yxy).z - map(pos - eps.yxy).z,
		map(pos + eps.yyx).z - map(pos - eps.yyx).z
	);
	return normalize(normal);
}


//	AMBIENT OCCULUSION
float ao( in vec3 pos, in vec3 nor ){
	float occ = 0.0;
	float sca = 1.0;
	for( int i=0; i<5; i++ )
	{
		float hr = 0.01 + 0.12*float(i)/4.0;
		vec3 aopos =  nor * hr + pos;
		float dd = map( aopos ).x;
		occ += -(dd-hr)*sca;
		sca *= 0.95;
	}
	return clamp( 1.0 - 3.0*occ, 0.0, 1.0 );    
}


vec3 Uncharted2Tonemap( vec3 x ) {
	return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}

// https://www.unrealengine.com/blog/physically-based-shading-on-mobile
vec3 EnvBRDFApprox( vec3 SpecularColor, float Roughness, float NoV ) {
	const vec4 c0 = vec4( -1, -0.0275, -0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, -0.04 );
	vec4 r = Roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( -9.28 * NoV ) ) * r.x + r.y;
	vec2 AB = vec2( -1.04, 1.04 ) * a004 + r.zw;
	return SpecularColor * AB.x + AB.y;
}


// http://the-witness.net/news/2012/02/seamless-cube-map-filtering/
vec3 fix_cube_lookup( vec3 v, float cube_size, float lod ) {
	float M = max(max(abs(v.x), abs(v.y)), abs(v.z));
	float scale = 1.0 - exp2(lod) / cube_size;
	if (abs(v.x) != M) v.x *= scale;
	if (abs(v.y) != M) v.y *= scale;
	if (abs(v.z) != M) v.z *= scale;
	return v;
}

vec3 correctGamma(vec3 color, float g) {
	return pow(color, vec3(1.0/g));
}

vec3 getPbr(vec3 N, vec3 V, vec3 baseColor, float roughness, float metallic, float specular) {
	vec3 diffuseColor	= baseColor - baseColor * metallic;
	vec3 specularColor	= mix( vec3( 0.08 * specular ), baseColor, specular );	

	vec3 color;
	float roughness4 = pow(roughness, 4.0);
	
	// sample the pre-filtered cubemap at the corresponding mipmap level
	float numMips		= 6.0;
	float mip			= numMips - 1.0 + log2(roughness);
	vec3 lookup			= -reflect( V, N );
	lookup				= fix_cube_lookup( lookup, 512.0, mip );
	vec3 radiance		= pow( textureCubeLodEXT( uRadianceMap, lookup, mip ).rgb, vec3( 2.2 ) );
	vec3 irradiance		= pow( textureCube( uIrradianceMap, N ).rgb, vec3( 1 ) );
	
	// get the approximate reflectance
	float NoV			= saturate( dot( N, V ) );
	vec3 reflectance	= EnvBRDFApprox( specularColor, roughness4, NoV );
	
	// combine the specular IBL and the BRDF
    vec3 diffuse  		= diffuseColor * irradiance;
    vec3 _specular 		= radiance * reflectance;
	color				= diffuse + _specular;

	return color;
}


//	COLORING FUNCTION
#define COLOR_FOG vec3(.0, .0, .0)
#define COLOR_GOLD vec3(1.000, 0.766, 0.276)

vec3 applyFog( in vec3  rgb,       // original color of the pixel
               in float distance ) // camera to point distance
{
	float b = 0.2;
    float fogAmount = 1.0 - exp( -distance*b );
    vec3  fogColor  = vec3(0.5,0.6,0.7);
    return mix( rgb, COLOR_FOG, fogAmount );
}

vec3 getColor(vec3 pos, vec3 dir, float colorIndex) {
	vec3 color;

	vec3 N = computeNormal(pos);
	float _ao = ao(pos, N);

	if(colorIndex < .5) {
		color = getPbr(N, -dir, uBaseColor, uRoughness, uMetallic, uSpecular);
	} else {
		vec3 noise = texture2D(uTextureNoise, uv * 4.0).rgb;
		vec3 normal = normalize(N + noise);
		color = getPbr(normal, -dir, COLOR_GOLD, 0.95, 0.85, 0.95);
	}

	color *= _ao;


	color = applyFog(color, length(pos));

	// apply the tone-mapping
	color				= Uncharted2Tonemap( color * uExposure );

	// white balance
	color				= color * ( 1.0 / Uncharted2Tonemap( vec3( 20.0 ) ) );
	
	// gamma correction
	color				= pow( color, vec3( 1.0 / uGamma ) );

	return color;
}


vec3 getColorGlass(vec3 pos, vec3 dir) {
	vec3 N = computeNormalGlass(pos);
	return getPbr(N, -dir, vec3(1.0), 0.0, 1.0, 1.0);
}


//	CAMERA CONTROL
mat3 setCamera( in vec3 ro, in vec3 ta, float cr ) {
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

void main(void) {
	float r  = uRadius;
	float tr = cos(uAngles.x) * r;
	vec3 pos = vec3(cos(uAngles.y) * tr, sin(uAngles.x) * r, sin(uAngles.y) * tr);
	vec3 posGlass = vec3(pos);
	vec3 ta  = vec3( 0.0, 0.0, 0.0 );
	mat3 ca  = setCamera( pos, ta, 0.0 );
	vec3 dir = ca * normalize( vec3(uv, uFOV) );

	vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
	bool hit = false;
	bool hitGlass = false;
	float colorIndex = 0.0;

	for( int i = 0; i < NUM_STEPS; i++) {
		vec3 result = map(pos);
		vec3 resultGlass = map(posGlass);
		float d = result.x;
		float dSphere = resultGlass.z;
		colorIndex = result.y;

		if(d < 0.01) {	hit = true;	}
		if(dSphere < 0.01) {	hitGlass = true;	}

		pos += d * dir;
		posGlass += dSphere * dir;
	}

	if(hit) {
		color.rgb = getColor(pos, dir, colorIndex);
		color.a = 1.0;
	}


	if(hitGlass) {
		vec3 colorGlass = getColorGlass(posGlass, dir);
		// vec3 NN = computeNormalGlass(posGlass);
		// color.rgb = NN;
		color.rgb += colorGlass * 0.2;
	}

	gl_FragColor = color;
	// gl_FragColor = vec4(vec3(uSpecular), 1.0);
}