
local menori = require 'menori'

local ml = menori.ml
local vec3 = ml.vec3
local quat = ml.quat

local scene = menori.Scene:extend('tch_scene')

local width = 640
local height = 480

local mx, my = 0, 0

local ship = {
	rot_angle = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0)),

	-- reorient player model to game space
	zero_rot = quat.from_euler_angles(math.rad(0), math.rad(180), math.rad(-90)),

	actual = {yaw = 0, pitch = 0, roll = 0},
	actual_screen_aim = {x = 0, y = 0},

}

local player = {

	root = {

		zero_rot = quat.from_euler_angles(math.rad(0), math.rad(180), math.rad(-90)),   -- quat to reorient model to game space

		d_rot = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0)),          -- rotational velocity

		d_rot_t = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0)),        -- rot from zero; d_rot_t = d_rot_t * (d_rot * dt)

		absolute_rot = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0)),   -- actual rotation of model; self.node:set_rotation(zero_rot * d_rot_t)

		absolute_rot_vector = vec3(0, 0, 0),                                            -- actual vector where nose is pointing


		zero_pos = vec3(0, 0, 0),     -- offset

		d_vel = vec3(0, 0, 0),        -- acc vector

		d_pos = vec3(0, 0, 0),        -- velocity vector

		d_pos_t = vec3(0, 0, 0),      -- position before offset; d_pos_t = d_pos_t + d_pos * dt

		absolute_pos = vec3(0, 0, 0), -- position in game space; absolute_pos = absolute_pos + d_pos_t
	},

	gun = {

		zero_rot = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0)),     -- zero rotation of "gun" relative to model

		abs_aim_vector = vec3(0, 0, 0),                                               -- absolute aim vector

		aim_limits = {x = math.rad(30), y = math.rad(30)}                             -- limits of gimbal relative to model (radians from zero vector)




	}


}


function player:update(dt)
	player.root.d_rot_t = player.root.d_rot_t * (player.root.d_rot * dt)
	player.root.absolute_rot = player.root.zero_rot * player.root.d_rot_t

	player.root.d_pos_t = player.root.d_pos * dt + player.root.d_pos_t
	player.root.absolute_pos =  player.root.zero_pos + player.root.d_pos_t

	-- velocity vector depends on rotation vector but with a delay, especially in low air pressure environments
	-- oh shit it's vector projection i think
end




function scene:init()
	scene.super.init(self)

	local w, h = width, height

	self.camera = menori.PerspectiveCamera(60, width/height, 0.5, 1024)
	self.environment = menori.Environment(self.camera)

	self.root_node = menori.Node()

	local gltf = menori.glTFLoader.load('assets/models/tancho_model.glb')

	local scenes = menori.NodeTreeBuilder.create(gltf, function (scene, builder)
		self.animations = menori.glTFAnimations(builder.animations)
		self.animations:set_action(1)
	end)

	self.root_node:attach(scenes[1])
	self.angle = 0
	self.view_scale = 0.5

end


function scene:render()
	local w, h = width, height

	love.graphics.clear(0.5, 0, 0.5, 1)

	self:render_nodes(self.root_node, self.environment, {
		node_sort_comp = menori.Scene.alpha_mode_comp
	})

	love.graphics.setColor(1,1,0,1)
	love.graphics.print('rendered', 0, 0)
	love.graphics.print(w, 0, 25)
	love.graphics.print(h, 0, 50)
	love.graphics.print(love.timer.getFPS(), 0, 75)

	love.graphics.print(mx, 50, 40)
	love.graphics.print(my, 50, 65)
	love.graphics.print(self.camera.eye.x, 50, 90)

	love.graphics.rectangle('line', mx-5, my-5, 10, 10)
	love.graphics.rectangle('line', mx-10, my-10, 20, 20)


	love.graphics.rectangle('line', ship.actual_screen_aim.x-4, ship.actual_screen_aim.y-4, 8, 8)

	love.graphics.setColor(1,1,0,1)
	love.graphics.rectangle('line', 0, 0, w, h)
end


function scene:update(dt)

	-- recursively update the scene nodes
	self:update_nodes(self.root_node, self.environment)

	-- spinning angle for testing
	self.angle = self.angle + 100*dt

	-- self.root_node.rot_angle = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0)) --yaw, pitch, roll
	
	-- camera rotations relative to player model
	self.camera.zero_rot_to_model = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0))
	self.camera.rot_to_model = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0))

	-- get angle to reticle
	local aim_plane = 1024/2
	local aim_vector = vec3(mx - width / 2, my - height / 2, aim_plane):normalize()

	-- rotate ship to point to reticle
	local vax, vay, vaz = aim_vector:unpack()
	local aim_quat = quat.from_euler_angles(-math.asin(vax / vaz), math.asin(vay / vaz), 0)

	ship.rot_angle = quat.slerp(ship.rot_angle, aim_quat, 5 * dt)

	ship.actual.roll, ship.actual.pitch, ship.actual.yaw = ship.rot_angle:to_euler()
	ship.actual.yaw = -ship.actual.yaw

	--print(ship.actual.yaw)
	--print(ship.actual.pitch)

	ship.actual_screen_aim = {  
		x = math.tan(ship.actual.yaw) * aim_plane + width / 2,
		y = math.tan(ship.actual.pitch) * aim_plane + height / 2,
	}


	--ship.rot_angle = quat.from_angle_axis(math.rad(180), vax, vay, vaz)

	self.root_node:set_rotation(ship.zero_rot * ship.rot_angle)



	-- rotate the camera
	local v = vec3(6, 0, 0)
	self.camera.center = v
	self.camera.eye_distance = 50

	-- pos of camera before rotation
	local pre_camera_vector = vec3(self.camera.eye_distance, 0, 0) - self.camera.center

	-- rotate camera to zero point
	local zero_camera_vector = (self.camera.zero_rot_to_model * quat(pre_camera_vector:unpack(), 0)) * self.camera.zero_rot_to_model:conjugate()
	-- rotate camera to offset point
	local cv = (self.camera.rot_to_model * zero_camera_vector) * self.camera.rot_to_model:conjugate()

	-- vec3 from quat
	local cx, cy, cz = cv
	self.camera.camera_vector = vec3(cx, cy, cz)

	self.camera.eye = self.camera.camera_vector + self.camera.center

	self.camera:update_view_matrix()

	-- updating scene animations
	self.animations:update(dt)
	
end


function scene:resize_camera(w, h)
	width = w
	height = h
	self.camera = menori.PerspectiveCamera(60, w/h, 0.1, 1024)
	self.environment = menori.Environment(self.camera)
end



function scene:mousemoved(msx, msy)
	mx = msx
	my = msy
	return mx, my
end


return scene
