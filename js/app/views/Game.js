define(function(require, exports, module) {
    "use strict";
	//includes Famous
    var Surface = require("famous/core/Surface");
    var ContainerSurface = require("famous/surfaces/ContainerSurface");
    var RenderNode = require("famous/core/RenderNode");
    var Modifier = require("famous/core/Modifier");
    var Transform = require("famous/core/Transform");
    var Timer = require("famous/utilities/Timer");
    var PhysicsEngine = require('famous/physics/PhysicsEngine');

    //include forces and constraints
    var VectorField = require("famous/physics/forces/VectorField");
    var Overlap = require("app/Overlap");
    var Wall = require("famous/physics/constraints/Wall");
    
    //Game Elements
    var Birdie = require("app/Bird");
    var Cloud = require("app/Cloud");
    var Pipe = require("app/Pipe");
    var Floor = require("app/Floor");
    var Score = require("app/Score");
    
    var GameSounds = require("app/GameSounds");

    //Widgets
    var BouncyPane = require("app/widgets/BouncyPane");
    var ButtonPane = require("app/widgets/ButtonPane");
    var SlideUpPane = require("app/widgets/SlideUpPane");

    //Utils
    var Utils = require('famous/utilities/Utility');
    var AppUtils = require("app/Util");

    //Transitions
    var Transitionable = require("famous/transitions/Transitionable");
    var SpringTransition = require("famous/transitions/SpringTransition")

    //View
    var View = require("famous/core/View");


    Transitionable.registerMethod("spring", SpringTransition);

    function Game(){
        View.apply(this, arguments);

        //create the container and link the physics engine
        this.surface = new ContainerSurface({
            size : this.options.boardSize,
            classes: ["game"]
        });

        _create.call(this);
        _init.call(this);

    };//end class
    Game.prototype = Object.create(View.prototype); 
    Game.prototype.constructor=Game; 
    Game.DEFAULT_OPTIONS = {
        gravityStrength     : .002,
        boardSize           : [640,960],
        pipeSpawnTime       : 1000,
        cloudSpawnTime      : 1000,
        gameVelocity        : 1
    };


    function _create(){
        this.visible        = true;
        this.started        = false;
        this.ended          = false;
        this.scorer         = null;
        this.score          = null;
        this.counters       = {pipe: 0, cloud: 0, floor: 0};
        this.birdie         = null;
        this.timers         = {clouds:null, pipes:null, floor: null, clean: null, counter: null};
        this.panes          = {welcome: null, gameOver: null, welcomeButtons: null, finalScore: null, gameOverButtons: null};
        this.node           = new RenderNode();
        this.physicsEngine = new PhysicsEngine({numConstraints: 4});

        this.birdie         = new Birdie(this.physicsEngine);

        //holders for the objects
        this.pipes     = [null, null, null];
        this.clouds         = [null, null, null, null, null, null, null, null, null, null];
        this.floor          = [null, null, null];

        

        this.modifier = new Modifier({
            transform: Transform.translate(0,0,0),
            origin: [.5,0]
        });
        
        //add the surface to the view and the physics to the surface
        this._add(this.modifier).add(this.surface);
        this.surface.add(this.physicsEngine);


        //this is the old way
        //this.surface.add(this.physicsEngine);

        //create gravity
        this.gravity = new VectorField({
            name : VectorField.FIELDS.CONSTANT, 
            strength : this.options.gravityStrength
        });

        //add the bird
        this.surface.add(this.birdie.particle).add(this.birdie);


        //add the floor
        var floorSurface = new Surface({
            classes: ["floor"],
            size:[640,215],
            properties: {backgroundColor:"pink"}
        });
        this.surface.add(new Modifier({transform: Transform.translate(0,745,0), origin:[0,0]})).add(floorSurface);


        _spawnFloor.call(this);

        //pipe events up and handle clicks
        this.surface.pipe(this._eventOutput);

        if( AppUtils.isMobile() ) { 
            this.surface.on("touchstart", _handleClicks.bind(this));
        } else { 
            this.surface.on("click", _handleClicks.bind(this));
        }
    }//end create


    function _init(){ 
        _showWelcomeScreen.call(this);
        _spawn.call(this);
    }//end init

    function _start(){

        this.started = true;
        this.ended = false;
        
        //get the UI in the correct state
        this.panes.welcome.hide();
        this.panes.welcomeButtons.hide();
        this.panes.ready.hide();

        this.scorer = new Score();
        this.scorer.attachToPhysics(this.physicsEngine);

        this.timers.pipes = Timer.setInterval(_spawnPipes.bind(this),1200);
        

        //attach forces to physics
        this.physicsEngine.attach([this.gravity]);

        //create a wall to cover the floor
        var wall = new Wall({
            n: [0,-1,0],
            d: 280,
            restitution : 0
        });

        //attatch the wall and look for collisions with the birdie
        this.physicsEngine.attach(wall, this.birdie.particle);
        wall.on("collision", _end.bind(this));

        //let er fly!
        this.birdie.start();
    }//end start

    function _restart(){
        location.reload();
        
    }//end restart

    function _stop(){
        this.birdie.stop();

        var len = this.physicsEngine._particles.length - 1;
        for (var i = len; i >= 0; i--) {
            this.physicsEngine._particles[i].v.x = 0;
        };
    };//end stop

    function _clearTimers(){
        //clear the timers
        for(var t in this.timers){
            Timer.clear(this.timers[t]);
            this.timers[t] = null;
        }
    }


    function _end(){
         //Bummer dude, game over
        if(!this.ended){
            this.ended = true;
            
            _clearTimers.call(this);

            //stop everything moving
            _stop.call(this);

            //flash and shake the screen
            _doooooh.call(this);


            //show the game over screen
            _showGameOverScreen.call(this);
        }//end if game playing
    }//end end


    function _incrementScore(data){
        //read the score from the pipe
        var score = data.target.pipeNumber;

        //NOTE: Each pipe ends up creating a lot of hits, so only score it once
        if(this.score != score){
            this.score = score;
            this.scorer.setScore(score);

            GameSounds.playSound( 2, 1.0 );
        }
    };//end method


    function _handleClicks(evt){
        evt.stopPropagation();//dont want to pass these up
        
        if (!this.ended && this.started){
            //fly little birdie fly 
            this.birdie.flap();
        }//end if playing
    };//end method





    //DO THIS NEXT - EXTRACT SPAWN CLASS
    function _spawnClouds(){
        if(!this.ended){
            var cloud = this.clouds[this.counters.cloud];
            if(cloud == null){
                cloud = new Cloud(this.physicsEngine);
                this.clouds[this.counters.cloud] = cloud;

                this.surface.add(cloud);
            }//end if cloud not created yet
            else{
                cloud.restart();
            }

            this.counters.cloud = (this.counters.cloud + 1) % this.clouds.length;
        }//end if game not ended
    };//end method

    function _spawnPipes(){
        if(!this.ended){
            var pipes = this.pipes[this.counters.pipe % this.pipes.length];
            if(pipes == null){
                pipes = new Pipe(
                    this,
                    this.physicsEngine,
                    {id:this.counters.pipe + 1}
                );



                //detects overlaps with pipes and the birdie
                var overlap = new Overlap();
                overlap.on("hit", _end.bind(this));
                this.physicsEngine.attach(overlap, pipes.particles, this.birdie.particle);

                //detect overlaps with the upper pipe and the scorer
                var overlapScore = new Overlap();
                overlapScore.on("hit", function(data){
                    _incrementScore.call(this, data);
                }.bind(this));
                this.physicsEngine.attach(overlapScore, pipes.particles[0], this.scorer.particle);





                this.pipes[this.counters.pipe % this.pipes.length] = pipes;

            }//end if pipes did not exist
            else{
                pipes.restart({id:this.counters.pipe + 1});
            }

            //incrament the counter
            this.counters.pipe++;
        }//end if game not over
    };//end method

    function _spawnFloor(){
        if(!this.ended){
            var floor = this.floor[this.counters.floor];
            if(floor == null){
                var opts = {};
                if (this.counters.floor == 0){opts.initPos = 0;}
                floor = new Floor(this, this.physicsEngine, opts);
                this.floor[this.counters.floor] = floor;

                this.surface.add(floor);
            }//end if floor not created yet
            else{
                floor.restart();
            }


            this.counters.floor = (this.counters.floor + 1) % this.floor.length;
        }//end if game not ended
    };//end method

    function _spawn(){
        //Spawn the scene
        this.timers.clouds  = Timer.setInterval(_spawnClouds.bind(this),1000);
        this.timers.floor   = Timer.setInterval(_spawnFloor.bind(this),1000);
    }//end spawn

    function  _showWelcomeScreen(){
        this.panes.welcome = new BouncyPane(this.physicsEngine, {
            content: "<h1>Famous Bird</h1>",
            classes: ["startup"]
        });

        this._add(this.panes.welcome);
        this.panes.welcome.show();

        this.panes.welcomeButtons = new ButtonPane(this.surface, {
            buttons: [
                {text: "START", callback: _showGetReadyScreen.bind(this), offsetX: -120},
                {text: "SCORES", callback: _showHighScores.bind(this), offsetX: 120}
            ]
        });
        this.panes.welcomeButtons.show();


        //make sure draggable events on these views are piped up
        this.panes.welcome.pipe(this._eventOutput);
        this.panes.welcomeButtons.pipe(this._eventOutput);
    };

    function _showGetReadyScreen(){
        this.panes.welcome.hide();
        this.panes.welcomeButtons.hide();

        this.panes.ready = new BouncyPane(this.physicsEngine, {
            content: "<h1>Get Ready</h1><p></p>",
            classes: ["getReady"]
        });

        //make sure draggable events on these views are piped up
        this.panes.ready.pipe(this._eventOutput);
        Timer.setTimeout(_start.bind(this), 2000);
    };

    function _showGameOverScreen(){
        this.scorer.hide();

        this.panes.gameOver = new BouncyPane(this.physicsEngine, {
            content: "<h1>Game Over</h1>",
            classes: ["gameOver"]
        });
        this.panes.gameOver.show();

        this.panes.gameOverButtons = new ButtonPane(this.surface, {
            buttons: [
                {text: "OK", callback: _restart.bind(this), offsetX: -120},
                {text: "SHARE", callback: _share.bind(this), offsetX: 120}
            ]
        });

        //make sure draggable events on these views are piped up
        this.panes.gameOver.pipe(this._eventOutput);
        this.panes.gameOverButtons.pipe(this._eventOutput);


        _createFinalScorePane.call(this, "<div class='currentScore'>SCORE</div><div class='highScore'>BEST</div><div class='medal'>MEDAL</div>");

        //display the buttons pane
        Timer.setTimeout(function(){
            this.panes.gameOverButtons.show();
        }.bind(this),300);
    };//end function

    function _createFinalScorePane(content){
         var scoreSurface = new Surface({
            content: "<h1>0</h1>",
            size: [100,80],
            classes: ["scorer"]
        });
        var scoreModifier = new Modifier({
            transform: Transform.translate(180,-60,50),
            origin: [.5,.5]
        });

        var highScoreSurface = new Surface({
            content: "<h1>" + (localStorage.getItem("HighScore") || 0) + "</h1>",
            size: [100,80],
            classes: ["scorer"]
        });
        var highScoreModifier = new Modifier({
            transform: Transform.translate(180,40,50),
            origin: [.5,.5]
        });


        this.panes.finalScore = new SlideUpPane(this.surface,
            {
                size:[500,250],
                content: content,
                classes: ["finalScore"]
            }
        );
        this.panes.finalScore.surface.add(scoreModifier).add(scoreSurface);
        this.panes.finalScore.surface.add(highScoreModifier).add(highScoreSurface);
        this.panes.finalScore.show();

        //start the score counting up
        var scoreUpCounter = 0;
        this.timers.counter = Timer.setInterval(function(){
            scoreUpCounter++;
            if(scoreUpCounter<= this.score){
                scoreSurface.setContent("<h1>" + scoreUpCounter + "</h1>");

                //set the highscore if higher than the local score
                if(scoreUpCounter > localStorage.getItem("HighScore")){
                    localStorage.setItem("HighScore", scoreUpCounter);
                    highScoreSurface.setContent("<h1>" + scoreUpCounter + "</h1>");
                }
            }
            else{
                Timer.clear(this.timers.counter);
            }
        }.bind(this),40);
    }//end create final score pane


    function _doooooh(){

        GameSounds.playSound(1, 1.0);


        //create the game over flash surface
        var flashSurface = new Surface({
            size : this.options.boardSize,
            classes: ["gameOverFlash"]
        });
        var flashModifier = new Modifier({
            opacity: .001,//hack to get around a bug
            origin: [.5,.5]
        });

        //add the flash screen
        this._add(flashModifier).add(flashSurface);

        

        //flash the screen
        flashSurface.setClasses(["gameOverFlash","gameOverFlashActive"]);
        flashModifier.setOpacity(.75, {duration: 50}, function(){
            flashModifier.setOpacity(0, {duration: 50});
            flashSurface.setClasses(["gameOverFlash"]);
            flashModifier.setTransform(Transform.translate(0,0,-1));
        });



        //shake the screen
        var spring = {
            method: "spring",
            period: 100,
            dampingRatio: .1
        };

        //in order to shake the screen, we displace it, then move it back using our spring
        //we do this so that it shake about the origin
        this.modifier.setTransform(Transform.translate(-10,-10,0));
        this.modifier.setTransform(Transform.translate(0,0,0),spring);

    };//end method


    function _showHighScores(){
        alert("Whoah! This agression will not stand man! This hasnt been implemented.");
    };

    function _share(){
        alert("This is a private beta, no sharing for now.");
    };

    Game.prototype.hide = function(){
        this.visible = false;
    };//end show
    Game.prototype.show = function(){
        this.visible = true;
    };//end show

    Game.prototype.render = function(){
        // return startupSurface.render();
        if(this.visible){
            return this._node.render();
        }//end if visible

        return undefined;
    };//end render
  
    module.exports = Game;
});
