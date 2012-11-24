/*
 * steering-behaviors
 * https://github.com/hurik/impact-steering-behaviors
 *
 * BETA
 *
 * IMPORTANT:
 * You need this plugins:
 * line-of-sight - https://github.com/hurik/impact-line-of-sight
 * vector2d      - https://github.com/hurik/impact-vector2d
 *
 * Andreas Giemza
 * andreas@giemza.net
 * http://www.hurik.de/
 *
 * This work is licensed under the Creative Commons Attribution 3.0 Unported License. To view a copy of this license, visit http://creativecommons.org/licenses/by/3.0/.
 *
 * Credits:
 * "Programming Game AI by Example" by Mat Buckland (http://www.jblearning.com/Catalog/9781556220784/student/)
 *
 */

ig.module(
	'plugins.steering-behaviors'
)
.requires(
	'impact.entity'
)
.defines(function() {

ig.Entity.inject({
	mass: 1,
	maxSpeed: 500,
	maxForce: 200,

	
	// This variables are very often needed, so they are update in the entity update() to save cpu time
	// Center of the entity
	vEntityCenter: new ig.Vec2(0, 0),
	// Heading (normalized vel)
	vHeading: new ig.Vec2(0, -1),
	// Perpendicular heading
	vHeadingPerp: new ig.Vec2(1, 0),

	// For better 
	bounciness: 1,
	minBounceVelocity: 0,

	// Calculation settings
	avoidanceActive: false,
	fleeActive: false,
	separationActive: false,
	alignmentActive: false,
	cohesionActive: false,
	wanderActive: false,

	avoidanceWeight: 20,
	fleeWeight: 10,
	separationWeight: 100,
	alignmentWeight: 50,
	cohesionWeight: 0.25,
	wanderWeight: 4,

	// avoidance()
	avoidanceFeelerLenghtFactor: 5,

	// wander() settings
	wanderRadius: 20,
	wanderDistance: 30,
	wanderJitter: 200,

	// getNearEntities() settings
	neighborsType: '',
	neighborsDistance: 50,

	// flee() settings
	fleeFromPos: null,

	// ---------- Internal ----------
	// wander() internal
	vWanderTargert: new ig.Vec2(0, 0),

	// avoidance() internal
	vAvoidanceDistance: new ig.Vec2(0, 0),
	vAvoidanceFarDistance: new ig.Vec2(0, 0),
	vAvoidanceUp: new ig.Vec2(0, 0),
	vAvoidanceDown: new ig.Vec2(0, 0),

	vAvoidanceFarLeftStart: new ig.Vec2(0, 0),
	vAvoidanceFarLeftEnd: new ig.Vec2(0, 0),

	vAvoidanceFrontLeftStart: new ig.Vec2(0, 0),
	vAvoidanceFrontLeftEnd: new ig.Vec2(0, 0),

	vAvoidanceFrontRightStart: new ig.Vec2(0, 0),
	vAvoidanceFrontRightEnd: new ig.Vec2(0, 0),

	vAvoidanceFarRightStart: new ig.Vec2(0, 0),
	vAvoidanceFarRightEnd: new ig.Vec2(0, 0),

	avoidanceCollision: new Array(4),
	avoidanceOvershoot: new Array(4),

	avoidancePreferedDirection: 0,


	init: function(x, y, settings) {
		this.a


		this.parent(x, y, settings);
	},

	update: function() {


		this.last.x = this.pos.x;
		this.last.y = this.pos.y;

		var temp = this.calculateSterringForce();

		this.accel = ig.Vector2D.scalarMult(temp, 1 / this.mass);

		this.vel.x += this.accel.x * ig.system.tick;
		this.vel.y += this.accel.y * ig.system.tick;

		this.vel = ig.Vector2D.truncate(this.vel, this.maxSpeed);

		// movement & collision
		var mx = this.vel.x * ig.system.tick;
		var my = this.vel.y * ig.system.tick;

		var res = ig.game.collisionMap.trace(
		this.pos.x, this.pos.y, mx, my, this.size.x, this.size.y);
		this.handleMovementTrace(res);

		// Update vEntityCenter
		this.vEntityCenter.x = this.pos.x + (this.size.x / 2);
		this.vEntityCenter.y = this.pos.y + (this.size.y / 2);

		// Update the vHeading and vHeadingPerp only when vel > 0
		var velMagnitude = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);

		if(velMagnitude > 0) {
			this.vHeading.x = this.vel.x / velMagnitude;
			this.vHeading.y = this.vel.y / velMagnitude;

			this.vHeadingPerp.x = -this.vHeading.y;
			this.vHeadingPerp.y = this.vHeading.x;
		}

		if(this.currentAnim) {
			this.currentAnim.update();
		}

		// Update the animation heading
		this.currentAnim.angle = this.vHeading.azimuth() + Math.PI / 2;
	},

	calculateSterringForce: function() {
		var vSteeringForce = new ig.Vec2(0, 0),
			vForce = new ig.Vec2(0, 0);

		if(this.avoidanceActive) {
			vForce = ig.Vector2D.scalarMult(this.avoidance(), this.avoidanceWeight);

			if(!this.accumulateForce(vSteeringForce, vForce)) {
				return vSteeringForce;
			}
		}

		if(this.fleeActive) {
			vForce = ig.Vector2D.scalarMult(this.flee(this.fleeFromPos), this.fleeWeight);

			if(!this.accumulateForce(vSteeringForce, vForce)) {
				return vSteeringForce;
			}
		}

		if(this.separationActive || this.alignmentActive || this.cohesionActive) {
			var neighbors = this.getNeighbors(this.neighborsDistance);

			if(this.separationActive) {
				vForce = ig.Vector2D.scalarMult(this.seperation(neighbors), this.separationWeight);

				if(!this.accumulateForce(vSteeringForce, vForce)) {
					return vSteeringForce;
				}
			}

			if(this.alignmentActive) {
				vForce = ig.Vector2D.scalarMult(this.alignment(neighbors), this.alignmentWeight);

				if(!this.accumulateForce(vSteeringForce, vForce)) {
					return vSteeringForce;
				}
			}

			if(this.cohesionActive) {
				vForce = ig.Vector2D.scalarMult(this.cohesion(neighbors), this.cohesionWeight);

				if(!this.accumulateForce(vSteeringForce, vForce)) {
					return vSteeringForce;
				}
			}

		}

		if(this.wanderActive) {
			vForce = ig.Vector2D.scalarMult(this.wander(), this.wanderWeight);

			if(!this.accumulateForce(vSteeringForce, vForce)) {
				return vSteeringForce;
			}
		}

		return vSteeringForce;
	},

	accumulateForce: function(vSteeringForce, vForceToAdd) {
		var vTemp;

		var lengthSoFar = ig.Vector2D.length(vSteeringForce);

		var lengthRemaining = this.maxForce - lengthSoFar;

		if(lengthRemaining <= 0.000001) {
			return false;
		}

		var lengthToAdd = ig.Vector2D.length(vForceToAdd);

		if(lengthToAdd < lengthRemaining) {
			vTemp = ig.Vector2D.add(vSteeringForce, vForceToAdd);

			vSteeringForce.x = vTemp.x;
			vSteeringForce.y = vTemp.y;
		} else {
			vTemp = ig.Vector2D.scalarMult(ig.Vector2D.norm(vForceToAdd), lengthRemaining);

			vSteeringForce.x = vTemp.x;
			vSteeringForce.y = vTemp.y;
		}

		return true;
	},

	seek: function(vTargetPos) {
		// Vector2D: vDesiredVelocity = norm(vTargetPos - this.pos) * this.maxSpeed
		var vDesiredVelocity = ig.Vector2D.scalarMult(ig.Vector2D.norm(ig.Vector2D.sub(vTargetPos, this.pos)), this.maxSpeed);

		// Vector2D: return (vDesiredVelocity - this.vel)
		return ig.Vector2D.sub(vDesiredVelocity, this.vel);
	},

	flee: function(vTargetPos) {
		// Vector2D: vDesiredVelocity = norm(this.pos - vTargetPos) * this.maxSpeed
		var vDesiredVelocity = ig.Vector2D.scalarMult(ig.Vector2D.norm(ig.Vector2D.sub(this.pos, vTargetPos)), this.maxSpeed);

		// Vector2D: return (vDesiredVelocity - this.vel)
		return ig.Vector2D.sub(vDesiredVelocity, this.vel);
	},

	// TODO: Not working well at the moment ...
	arrive: function(vTargetPos, deceleration) {
		// Vector2D: vToTarget = vTargetPos - this.pos
		var vToTarget = ig.Vector2D.sub(vTargetPos, this.pos);
		// Vector2D: distance = lenght(vToTarget)
		var distance = ig.Vector2D.length(vToTarget);

		if(distance > 0) {
			var speed = distance / (deceleration * 0.5);
			speed = Math.min(speed, this.maxSpeed);

			// Vector2D: vDesiredVelocity = vToTarget * (speed / distance)
			var vDesiredVelocity = ig.Vector2D.scalarMult(vToTarget, speed / distance);

			// Vector2D: return (vDesiredVelocity - this.vel)
			return ig.Vector2D.sub(vDesiredVelocity, this.vel);
		} else {
			return ig.Vector2D.zero();
		}
	},

	wander: function() {
		this.vWanderTargert.x += (Math.random() * 2 - 1) * this.wanderJitter * ig.system.tick;
		this.vWanderTargert.y += (Math.random() * 2 - 1) * this.wanderJitter * ig.system.tick;

		this.vWanderTargert.normalize().scale(this.wanderRadius);

		return this.vHeading.clone().scale(this.wanderDistance).add(this.vWanderTargert).subtract(this.vel);
	},

	avoidance: function() {
		var vSteeringForce = new ig.Vec2(0, 0);

		// Distance vectors and scalar
		var farDistance = this.size.y * (this.avoidanceFeelerLenghtFactor + 1);
		this.vAvoidanceFarDistance.x = this.vHeading.x * farDistance;
		this.vAvoidanceFarDistance.y = this.vHeading.y * farDistance;

		var distance = this.size.y * this.avoidanceFeelerLenghtFactor;
		this.vAvoidanceDistance.x = this.vHeading.x * distance;
		this.vAvoidanceDistance.y = this.vHeading.y * distance;

		// Down vector (for the far left and far right feeler)
		this.vAvoidanceDown.x = this.vHeading.x * -this.size.y / 2;
		this.vAvoidanceDown.y = this.vHeading.y * -this.size.y / 2;

		// Up vector (for the front left and front right feeler)
		this.vAvoidanceUp.x = this.vHeading.x * this.size.y / 2;
		this.vAvoidanceUp.y = this.vHeading.y * this.size.y / 2;

		// Far left feeler
		this.vAvoidanceFarLeftStart.x = this.vHeadingPerp.x;
		this.vAvoidanceFarLeftStart.y = this.vHeadingPerp.y;

		this.vAvoidanceFarLeftStart.scale(-this.size.x).add(this.vAvoidanceDown).add(this.vEntityCenter);

		this.vAvoidanceFarLeftEnd.x = this.vAvoidanceFarLeftStart.x;
		this.vAvoidanceFarLeftEnd.y = this.vAvoidanceFarLeftStart.y;

		this.vAvoidanceFarLeftEnd.add(this.vAvoidanceFarDistance);

		// Front left feeler
		this.vAvoidanceFrontLeftStart.x = this.vHeadingPerp.x;
		this.vAvoidanceFrontLeftStart.y = this.vHeadingPerp.y;

		this.vAvoidanceFrontLeftStart.scale(-this.size.x / 4).add(this.vAvoidanceUp).add(this.vEntityCenter);

		this.vAvoidanceFrontLeftEnd.x = this.vAvoidanceFrontLeftStart.x;
		this.vAvoidanceFrontLeftEnd.y = this.vAvoidanceFrontLeftStart.y;

		this.vAvoidanceFrontLeftEnd.add(this.vAvoidanceDistance);

		// Front right feeler
		this.vAvoidanceFrontRightStart.x = this.vHeadingPerp.x;
		this.vAvoidanceFrontRightStart.y = this.vHeadingPerp.y;

		this.vAvoidanceFrontRightStart.scale(this.size.x / 4).add(this.vAvoidanceUp).add(this.vEntityCenter);

		this.vAvoidanceFrontRightEnd.x = this.vAvoidanceFrontRightStart.x;
		this.vAvoidanceFrontRightEnd.y = this.vAvoidanceFrontRightStart.y;

		this.vAvoidanceFrontRightEnd.add(this.vAvoidanceDistance);

		// Far right feeler
		this.vAvoidanceFarRightStart.x = this.vHeadingPerp.x;
		this.vAvoidanceFarRightStart.y = this.vHeadingPerp.y;

		this.vAvoidanceFarRightStart.scale(this.size.x).add(this.vAvoidanceDown).add(this.vEntityCenter);

		this.vAvoidanceFarRightEnd.x = this.vAvoidanceFarRightStart.x;
		this.vAvoidanceFarRightEnd.y = this.vAvoidanceFarRightStart.y;

		this.vAvoidanceFarRightEnd.add(this.vAvoidanceFarDistance);

		// Check for collision
		this.avoidanceCollision[0] = ig.game.collisionMap._traceLosStep(this.vAvoidanceFarLeftStart.x, this.vAvoidanceFarLeftStart.y, this.vAvoidanceFarLeftEnd.x, this.vAvoidanceFarLeftEnd.y);
		this.avoidanceCollision[1] = ig.game.collisionMap._traceLosStep(this.vAvoidanceFrontLeftStart.x, this.vAvoidanceFrontLeftStart.y, this.vAvoidanceFrontLeftEnd.x, this.vAvoidanceFrontLeftEnd.y);
		this.avoidanceCollision[2] = ig.game.collisionMap._traceLosStep(this.vAvoidanceFrontRightStart.x, this.vAvoidanceFrontRightStart.y, this.vAvoidanceFrontRightEnd.x, this.vAvoidanceFrontRightEnd.y);
		this.avoidanceCollision[3] = ig.game.collisionMap._traceLosStep(this.vAvoidanceFarRightStart.x, this.vAvoidanceFarRightStart.y, this.vAvoidanceFarRightEnd.x, this.vAvoidanceFarRightEnd.y);

		if(!this.avoidanceCollision[0] && !this.avoidanceCollision[1] && !this.avoidanceCollision[2] && !this.avoidanceCollision[3]) {
			// No collision, only reset avoidancePreferedDirection
			this.avoidancePreferedDirection = 0;
		} else if(this.avoidanceCollision[0] && this.avoidanceCollision[1] && this.avoidanceCollision[2] && this.avoidanceCollision[3]) {
			// Collsion on all feelers
			for(var i = 0; i < 4; i++) {
				if(this.avoidanceCollision[i]) {
					if(i == 0 || i == 3) {
						this.avoidanceOvershoot[i] = farDistance - this.avoidanceCollision[i];
					} else {
						this.avoidanceOvershoot[i] = distance - this.avoidanceCollision[i];
					}
				}
			}

			var biggest = 0,
				biggestValue = -999999;

			for(var i = 0; i < 4; i++) {
				if(this.avoidanceCollision[i] && this.avoidanceOvershoot[i] > biggestValue) {
					biggest = i;
					biggestValue = this.avoidanceOvershoot[i];
				}
			}

			if(this.avoidancePreferedDirection == 0) {
				// Get the prefered escape direction
				// 1 = rigt and 2 = left
				if(biggest == 0 || biggest == 1) {
					this.avoidancePreferedDirection = 1;
				} else {
					this.avoidancePreferedDirection = 2;
				}

				var right = ig.Vector2D.add(this.vEntityCenter, ig.Vector2D.scalarMult(this.vHeadingPerp, this.size.x * 3));
				var left = ig.Vector2D.add(this.vEntityCenter, ig.Vector2D.scalarMult(this.vHeadingPerp, -this.size.x * 3));

				var rightLenght = ig.game.collisionMap._traceLosStep(this.vEntityCenter.x, this.vEntityCenter.y, right.x, right.y);
				var leftLenght = ig.game.collisionMap._traceLosStep(this.vEntityCenter.x, this.vEntityCenter.y, left.x, left.y);

				if(rightLenght < leftLenght) {
					this.avoidancePreferedDirection = 1;
				}

				if(leftLenght < rightLenght) {
					this.avoidancePreferedDirection = 2;
				}
			}

			biggestValue = Math.abs(biggestValue);

			if(this.avoidancePreferedDirection == 1) {
				vSteeringForce = ig.Vector2D.scalarMult(this.vHeadingPerp, biggestValue);
			} else if(this.avoidancePreferedDirection == 2) {
				vSteeringForce = ig.Vector2D.scalarMult(this.vHeadingPerp, -biggestValue);
			}
		} else {
			this.avoidancePreferedDirection = 0;

			for(var i = 0; i < 4; i++) {
				if(this.avoidanceOvershoot[i]) {
					if(i == 0 || i == 3) {
						this.avoidanceOvershoot[i] = farDistance - this.avoidanceOvershoot[i];
					} else {
						this.avoidanceOvershoot[i] = distance - this.avoidanceOvershoot[i];
					}
				}
			}

			var biggest = 0,
				biggestValue = -999999;

			for(var i = 0; i < 4; i++) {
				if(this.avoidanceOvershoot[i] && this.avoidanceOvershoot[i] > biggestValue) {
					biggest = i;
					biggestValue = this.avoidanceOvershoot[i];
				}
			}

			biggestValue = Math.abs(biggestValue);

			if(biggest == 0 || biggest == 1) {
				vSteeringForce = ig.Vector2D.scalarMult(this.vHeadingPerp, biggestValue);
			} else {
				vSteeringForce = ig.Vector2D.scalarMult(this.vHeadingPerp, -biggestValue);
			}
		}

		return vSteeringForce;
	},
	


	// TODO: Awfully slow ...
	getNeighbors: function(maxDistance) {
		// Create an empty array
		var neighbors = [];

		// For the check we use the distance square to save some cpu time
		maxDistance = maxDistance * maxDistance;

		// Get every entity with this type
		var entities = ig.game.getEntitiesByType(this.neighborsType);

		// Go through the entities
		for(var i = 0; i < entities.length; i++) {
			// Check if this entity is in distance
			// For speedup we use the distance square function
			if(ig.Vector2D.distanceSq(this.vEntityCenter, entities[i].vEntityCenter) < maxDistance) {
				// Put this entity on the nearEntitiesList
				neighbors.push(entities[i]);
			}
		}

		return neighbors;
	},

	seperation: function(neighbors) {
		var vSteeringForce = ig.Vector2D.zero();

		// Go through the neighbors
		for(var i = 0; i < neighbors.length; i++) {
			// Check if the current entity is not this entity
			if(neighbors[i] != this && !ig.Vector2D.equals(neighbors[i].pos, this.pos)) {
				if(!ig.game.collisionMap._traceLosStep(this.vEntityCenter.x, this.vEntityCenter.y, neighbors[i].vEntityCenter.x, neighbors[i].vEntityCenter.y)) {
					// Vector2D: vToNeighbor = this.pos - neighbors[i].pos
					var vToNeighbor = ig.Vector2D.sub(this.pos, neighbors[i].pos);

					// Vector2D: vSteeringForce = vSteeringForce + (norm(vToNeighbor) / lenght(vToNeighbor))
					vSteeringForce = ig.Vector2D.add(vSteeringForce, ig.Vector2D.scalarDivi(ig.Vector2D.norm(vToNeighbor), ig.Vector2D.length(vToNeighbor)));
				}
			}
		}

		return vSteeringForce;
	},

	alignment: function(neighbors) {
		var vAverageHeading = ig.Vector2D.zero(),
			neighborsCount = 0;

		// Go through the neighbors
		for(var i = 0; i < neighbors.length; i++) {
			// Check if the current entity is not this entity
			if(neighbors[i] != this) {
				if(!ig.game.collisionMap._traceLosStep(this.vEntityCenter.x, this.vEntityCenter.y, neighbors[i].vEntityCenter.x, neighbors[i].vEntityCenter.y)) {
					// Vector2D: vAverageHeading = vAverageHeading + neighbors[i].vHeading
					vAverageHeading = ig.Vector2D.add(vAverageHeading, neighbors[i].vHeading);

					neighborsCount++;
				}
			}
		}

		if(neighborsCount > 0) {
			// Vector2D: vAverageHeading = vAverageHeading / neighbors.length
			vAverageHeading = ig.Vector2D.scalarDivi(vAverageHeading, neighborsCount);

			// Vector2D: vAverageHeading = vAverageHeading - this.vHeading
			vAverageHeading = ig.Vector2D.sub(vAverageHeading, this.vHeading);
		}

		return vAverageHeading;
	},

	cohesion: function(neighbors) {
		var vSteeringForce = ig.Vector2D.zero(),
			vCenterOfMass = ig.Vector2D.zero(),
			neighborsCount = 0;

		// Go through the neighbors
		for(var i = 0; i < neighbors.length; i++) {
			// Check if the current entity is not this entity
			if(neighbors[i] != this) {
				if(!ig.game.collisionMap._traceLosStep(this.vEntityCenter.x, this.vEntityCenter.y, neighbors[i].vEntityCenter.x, neighbors[i].vEntityCenter.y)) {
					// Vector2D: vCenterOfMass = vCenterOfMass + neighbors[i].pos
					vCenterOfMass = ig.Vector2D.add(vCenterOfMass, neighbors[i].pos);

					neighborsCount++;
				}
			}
		}

		if(neighborsCount > 0) {
			// Vector2D: vCenterOfMass = vCenterOfMass / neighbors.length
			vCenterOfMass = ig.Vector2D.scalarDivi(vCenterOfMass, neighborsCount);

			vSteeringForce = this.seek(vCenterOfMass);
		}

		return vSteeringForce;
	}
});

});