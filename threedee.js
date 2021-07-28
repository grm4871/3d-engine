// author: grm4871

var canvas = document.querySelector('canvas');

cw = window.innerWidth;
canvas.width = cw;
ch = window.innerHeight;
canvas.height = ch;

var c = canvas.getContext('2d');

// Constants
var znear = .1;
var zfar = 1000;
var fov = 90;
var aspectratio = ch / cw;

class Matrix {
    constructor(li, size) {
        this.li = li;
        this.size = size;
    }

    get(x, y) {
        return this.li[x + y * this.size];
    }

    vecMul3(vec) {
        if(vec.size != 3) {
            throw new Error("Trying to transform a vector of the wrong size");
        }
        var x = vec.x * this.li[0] + vec.y * this.li[1] + vec.z * this.li[2];
        var y = vec.x * this.li[3] + vec.y * this.li[4] + vec.z * this.li[5];
        var z = vec.x * this.li[6] + vec.y * this.li[7] + vec.z * this.li[8];
        return new Vec3D(x,y,z);
    }

    vecMul4(vec) {
        if(vec.size != 4) {
            throw new Error("Trying to transform a vector of the wrong size");
        }
        var x = vec.x * this.li[0] + vec.y * this.li[1] + vec.z * this.li[2] + vec.w * this.li[3];
        var y = vec.x * this.li[4] + vec.y * this.li[5] + vec.z * this.li[6] + vec.w * this.li[7];
        var z = vec.x * this.li[8] + vec.y * this.li[9] + vec.z * this.li[10] + vec.w * this.li[11];
        var w = vec.x * this.li[12] + vec.y * this.li[13] + vec.z * this.li[14] + vec.w * this.li[15];
        return new Vec4D(x,y,z,w);
    }

    matmul(mat) {
        // only support square matrices of same size (for ease of use)
        if(this.size != mat.size) {
            throw new Error("Matrices must have the same size to multiply");
        }
        var li = [];
        for(var i = 0; i < this.size; i++) {
            for(var j = 0; j < this.size; j++) {
                var sum = 0;
                for(var k = 0; k < this.size; k++)  {
                    sum += this.get(i, k) * mat.get(k, j);
                }   
                li[i*this.size + j] = sum;
            }
        }
        if(this.size == 3) {
            return new Matrix(li, 3);
        }
    }
}

// builds a matrix from 3 vectors by treating each one as a basis column
function matrix_from_3_vectors(v1,v2,v3) {
    return new Matrix([v1.x,v1.y,v1.z,v2.x,v2.y,v2.z,v3.x,v3.y,v3.z], 3);
}

class Vec3D {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.size = 3;
    }
    
    add(vec) {
        return new Vec3D(this.x + vec.x, this.y + vec.y, this.z + vec.z);
    }
    
    sub(vec) {
        return new Vec3D(this.x - vec.x, this.y - vec.y, this.z - vec.z);
    }

    project() {
        var tempz = this.z;
        var q = (zfar) / (zfar - znear);
        var f = 1 / (Math.tan((fov / 2) / (90 * Math.PI)));
        var px = ((.75 / aspectratio) * this.x * f) / tempz;
        var py = (f * this.y) / tempz;
        var pz = tempz * q - znear * q;
        return new Vec3D(px, py, pz);
    }

    dot(vec) {
        return vec.x * this.x + vec.y * this.y + vec.z * this.z;
    }

    cross(vec) {
        var nx = this.y * vec.z - this.z * vec.y;
        var ny = this.z * vec.x - this.x * vec.z;
        var nz = this.x * vec.y - this.y * vec.x;
        return new Vec3D(nx, ny, nz);
    }
}

class Vec4D {
    constructor(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
        this.size = 4;
    }
}

class Camera {
    constructor(fd, up, pos) {
        // all of these should be 3d vectors
        this.fd = fd;
        this.up = up;
        this.rt = fd.cross(up);
        this.pos = pos;
    }

    move(x,y,z) {
        var t_mat = matrix_from_3_vectors(this.rt,this.up,this.fd);
        this.pos = this.pos.add(t_mat.vecMul3(new Vec3D(x,y,z)));
    }

    rotate(x,y,z) {
        var rm = rotation_matrix(x,y,z);
        this.fd = rm.vecMul3(this.fd);
        this.up = rm.vecMul3(this.up);
        this.rt = this.fd.cross(this.up);
    }

    // transforms a vector to camera-space coordinates
    transform(vec) {
        vec = vec.sub(this.pos);
        var t_mat = matrix_from_3_vectors(this.rt,this.up,this.fd);
        return t_mat.vecMul3(vec);
    }
}

// initial camera
var CAMERA = new Camera(new Vec3D(0,0,1), new Vec3D(0,1,0), new Vec3D(0,0,-50));


// Outputs a generalized rotation matrix from a given angle tuple in x, y, and z
function rotation_matrix(theta_x, theta_y, theta_z) {
    var rotx = new Matrix([1,0,0,0,Math.cos(theta_x),-Math.sin(theta_x),0,Math.sin(theta_x),Math.cos(theta_x)], 3);
    var roty = new Matrix([Math.cos(theta_y),0,Math.sin(theta_y),0,1,0,-Math.sin(theta_y),0,Math.cos(theta_y)], 3);
    var rotz = new Matrix([Math.cos(theta_z),-Math.sin(theta_z),0,Math.sin(theta_z),Math.cos(theta_z),0,0,0,1], 3);
    return rotx.matmul(roty.matmul(rotz));
}

// test matrix
mx = rotation_matrix(.01, .005, .02);

var world = [];

// load object file
// awful hacky code
var t = document.getElementById('input');

t.onclick = e => {
    var input = document.createElement('input');
    input.type = 'file';

    input.onchange = e => { 
        fr = new FileReader();
        
        var file = e.target.files[0];
        fr.readAsText(file);
        fr.onload = readerEvent => {
            // and now we actually have the raw data
            // i hate javascript
            v = []; // build list of vertices
            readerEvent.target.result.split('\n').forEach((line) => {
                items = line.split(' ');
                if(line[0] == 'v') {
                    v.push(new Vec3D(parseFloat(items[1]), parseFloat(items[2]), parseFloat(items[3])));
                }
                if(line[0] == 'f') {
                    try {
                        v1 = v[parseInt(items[1].split('/')[0]) - 1];
                        v2 = v[parseInt(items[2].split('/')[0]) - 1];
                        v3 = v[parseInt(items[3].split('/')[0]) - 1];
                        world.push([v1,v2,v3]);
                    } catch {
                        //pass
                    }
                }
            });
            t.hidden = true;
            document.getElementById('canvas').hidden = false;
            console.log(world.length);
            animate();
        }
    }
    input.click();
}

// todo refactor these out
camera = new Vec3D(0,0,1);
light = new Vec3D(0,1,0);

// movement events
var mvx = 0;
var mvy = 0;
var mvz = 0;
var rx = 0;
var ry = 0;
var rz = 0;
function move(e) {
    if(e.code == "ArrowRight") {
        ry = -.01;
    } else if(e.code == "ArrowLeft") {
        ry = .01;
    }
    if(e.code == "ArrowUp") {
        mvz = 1;
    } else if(e.code == "ArrowDown") {
        mvz = -1;
    }
    if(e.code == "KeyQ") {
        mvy = .1;
    } else if(e.code == "KeyE") {
        mvy = -.1;
    }
}
document.addEventListener('keydown', move);
function stop(e) {
    if(e.code == "ArrowRight" || e.code == "ArrowLeft") {
        ry = 0;
    }
    if(e.code == "ArrowUp" || e.code == "ArrowDown") {
        mvz = 0;
    }    
    if(e.code == "KeyQ" || e.code == "KeyE") {
        mvy = 0;
    }
}
document.addEventListener('keyup', stop);


// -- drawing routines --


function draw_triangle(trgl, shade) {
    c.beginPath();
    c.moveTo(trgl[0].x * cw * aspectratio + (cw / 2), trgl[0].y * ch + (ch / 2));
    c.lineTo(trgl[1].x * cw * aspectratio + (cw / 2), trgl[1].y * ch + (ch / 2));
    c.lineTo(trgl[2].x * cw * aspectratio + (cw / 2), trgl[2].y * ch + (ch / 2));
    c.fillStyle = shade;
    c.strokeStyle = "#000000";
    c.closePath();
    c.fill();
    c.stroke();
}

function animate() {
    requestAnimationFrame(animate);
    c.clearRect(0, 0, cw, ch);

    // move camera
    CAMERA.move(mvx, mvy, mvz);
    CAMERA.rotate(rx, ry, rz);

    // project to camera
    var triangles = [];
    world.forEach((t) => {
        var x = CAMERA.transform(t[0]);
        var y = CAMERA.transform(t[1]);
        var z = CAMERA.transform(t[2]);
        triangles.push([x.project(), y.project(), z.project()]);
    });

    // sort triangles
    triangles = triangles.sort((f, s) => {
        var z1 = f[0].z + f[1].z + f[2].z;
        var z2 = s[0].z + s[1].z + s[2].z;
        if(z1 > z2) {
            return -1;
        } else {
            return 1;
        }
    });

    // draw triangles
    triangles.forEach((t) => {
        // only draw a triangle if the camera can see it
        // aka, is the plane's normal vector dot the camera vector > 0
        var v1 = t[0].sub(t[1]);
        var v2 = t[0].sub(t[2]);
        var normal = v1.cross(v2);

        // and we can also shade the triangles based on that dot product
        // to give a nice rudimentary lighting effect
        var value = (255 * (1 - normal.dot(light)));
        if(value > 255) value = 255;
        var c = (Math.floor(value) * 0x010101).toString(16);
        if(c.length < 6) c = "0" + c;
        var shade = "#" + c;

        if(normal.dot(camera) > 0) draw_triangle(t, shade);
    });
    
    /*for(var i = 0; i < 8; i++) {
        cube[i] = mx.vecMul3(cube[i]);
        cube[i] = asdf.vecMul3(cube[i]);
    }*/

    // rotate
    world.forEach((t) => {
        t[0] = mx.vecMul3(t[0]);
        t[1] = mx.vecMul3(t[1]);
        t[2] = mx.vecMul3(t[2]);
    });
}