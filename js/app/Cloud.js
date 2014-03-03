define(function(require, exports, module) {
    "use strict";
	//Includes Famous Repositories
    var Surface = require("famous/Surface");
    var Modifier = require("famous/Modifier");
    var Matrix = require("famous/Matrix");

      
    /** @constructor */
    function Cloud(physicsEngine, opts){
        this.physicsEngine = physicsEngine;
        this.restart();
    }

    function _init(){
        this.opts = {
            yPos        : -Math.random() * 450,
            scale       : 2 + 2 * Math.random(),
            opacity     : 1 / (1.1 + Math.random()),
            velocity    : -.1 - Math.random() * .5,
            cloudType   : "cloud-type-" + parseInt((Math.random() * 1000)) % 3
        };
    }//end init

  
    function _create(){
    	this.transforms = [
            new Modifier({
    	        transform: Matrix.translate(0,this.opts.yPos,0),
                opacity: this.opts.opacity
    	    }),
            new Modifier({
                transform: Matrix.scale(this.opts.scale, this.opts.scale, 0)
            })];

	    //add the cloud off screen
        this.surface = new Surface({
            size : [128, 64],
            classes : ["cloud", this.opts.cloudType]
        });

	    //Create a physical particle
        this.particle = this.physicsEngine.createBody({
            shape : this.physicsEngine.BODIES.CIRCLE,
            m : 0,
            r : 0,
            p : [500,0,0],
            v : [this.opts.velocity,0,0]
        });

        //Render the Famous Surface from the particle
        this.particle.link(this.transforms[0]).link(this.transforms[1]).link(this.surface);

    };

    Cloud.prototype.restart = function(){
        this.physicsEngine.remove(this.particles);
        _init.call(this);
        _create.call(this);
    };


	module.exports = Cloud;
});

