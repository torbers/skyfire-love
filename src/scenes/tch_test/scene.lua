
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

		roll = 0,     -- rpy (relative to zero)
		pitch = 0,
		yaw = 0,

		absolute_rot = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0)),   -- actual rotation of model; self.node:set_rotation(zero_rot * d_rot_t)

		absolute_rot_vector = vec3(0, 0, 1),                                            -- actual vector where nose is pointing

		radial_out_rot_vector = vec3(0, 1, 0),                                          -- vector orthoganal to rotation vector pointing "up"
		

		radial_cross_section = 10.0,  -- area of model looking down from radial out

		thrust = 1.0,                 -- scalar value of thrust

		d_vel_air = vec3(0, 0, 0),    -- acceleration caused by air (only in radial out direction for now)

		d_vel_thrust = vec3(0, 0, 0), -- thrust vector as acc. d_vel_thrust = absolute_rot_vector * thrust


		zero_pos = vec3(0, 0, 0),     -- offset

		d_vel = vec3(0, 0, 0),        -- acc vector

		d_pos = vec3(0, 0, 0),        -- velocity vector (prograde)

		d_pos_t = vec3(0, 0, 0),      -- position before offset; d_pos_t = d_pos_t + d_pos * dt

		absolute_pos = vec3(0, 0, 0), -- position in game space; absolute_pos = absolute_pos + d_pos_t

	},

	gun = {

		zero_rot = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0)),     -- zero rotation of "gun" relative to model

		abs_aim_vector = vec3(0, 0, 0),                                               -- absolute aim vector

		aim_limits = {x = math.rad(30), y = math.rad(30)}                             -- limits of gimbal relative to model (radians from zero vector)




	}


}

local air_pressure = 1.0

function player:update(dt)
	-- do rotation update here
	-- speed of rotation probably depends on vec3.dot(player.root.absolute_rot_vector, player.root.d_pos)

	-- these are quats for rotation
	player.root.d_rot_t = player.root.d_rot_t * (player.root.d_rot * dt)
	player.root.absolute_rot = player.root.zero_rot * player.root.d_rot_t

		-- get normalized absolute rot vector
	 local x, y, z, w = ((player.root.absolute_rot * quat(0, 0, 1, 0)) * player.root.absolute_rot:conjugate()):unpack()
	 player.root.absolute_rot_vector = vec3(x, y, z)

		-- calculate acceleration vector
	-- make thrust vector
	player.root.d_vel_thrust = player.root.absolute_rot_vector * player.root.thrust

	-- make air vector
	--player.root.d_vel_air

	player.root.d_vel = player.root.d_vel_thrust + player.root.d_vel_air


		-- update vel and pos from acc
	-- these are vec3 for pos/vel/acc vectors
	player.root.d_pos = player.root.d_pos + player.root.d_vel
	player.root.d_pos_t = player.root.d_pos * dt + player.root.d_pos_t
	player.root.absolute_pos =  player.root.zero_pos + player.root.d_pos_t

	-- need to figure out node system to actually apply. boo
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
	

	if love.keyboard.isDown('a') then
		-- player.root.d_rot_t += dt -- no
	end


	-- self.root_node.rot_angle = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0)) --yaw, pitch, roll

	-- get angle to reticle
	local aim_plane = 1024/2
	local aim_vector = vec3(mx - width / 2, my - height / 2, aim_plane):normalize()

	-- rotate ship to point to reticle
	local vax, vay, vaz = aim_vector:unpack()
	local aim_quat = quat.from_euler_angles(-math.asin(vax / vaz), math.asin(vay / vaz), 0)

	player.root.d_rot_t = quat.slerp(player.root.d_rot_t, aim_quat, 5*dt)
	player.root.absolute_rot = player.root.zero_rot * player.root.d_rot_t


	player.root.roll, player.root.pitch, player.root.yaw = player.root.d_rot_t:to_euler()
	player.root.yaw = -player.root.yaw

	ship.actual_screen_aim = {  
		x = math.tan(player.root.yaw) * aim_plane + width / 2,
		y = math.tan(player.root.pitch) * aim_plane + height / 2,
	}

	self.root_node:set_rotation(player.root.absolute_rot)




	-- camera rotations relative to player model
	self.camera.zero_rot_to_model = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0))
	self.camera.rot_to_model = quat.from_euler_angles(math.rad(0), math.rad(0), math.rad(0))

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
