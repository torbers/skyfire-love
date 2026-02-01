

-- libs
local menori = require 'menori' -- 3d graphix


local scene_iterator = 1
local example_list = {
	{title = 'tch_test', path = 'scenes.tch_test.scene'},
}
for _, v in ipairs(example_list) do
	local Scene = require(v.path)
	menori.app:add_scene(v.title, Scene())
end
menori.app:set_scene('tch_test')



love.graphics.setDefaultFilter('nearest', 'nearest')
local window = {translateX = 0, translateY = 0, scale = 1, width = 640, height = 480}

-- window setup (more in conf.lua)
local width, height = love.graphics.getDimensions()
love.window.setMode(width, height, {resizable = true, borderless = false})


-- resize window & create canvases
window.width = window.height/height*width
window.translateX = 0
window.translateY = 0
window.scale = height/window.height

local canvas = love.graphics.newCanvas(window.width, window.height)

function love.load()
end


function love.update(dt)
	-- inputs
	menori.app:update(dt)
	mx, my = getMousePositionInWindow()
end


function love.draw()
	love.graphics.setCanvas({canvas, depth = true})

	--love.graphics.setColor(0,0,0, 1)
	--love.graphics.rectangle('fill', 0, 0, window.width, window.height)

	menori.app:render()

	-- debug
	love.graphics.setColor(1,1,1,1)
	love.graphics.rectangle('line', 0, 0, mx, my)
	love.graphics.rectangle('line', 0, 0, window.width, window.height)
	--love.graphics.rectangle('line', 0, 0, window.width/2, window.height/2)

	love.graphics.print(width, window.width/2, window.height/2)
	love.graphics.print(mx, window.width/2, window.height/2 + 50)
	love.graphics.print(my, window.width/2, window.height/2 + 100)
	love.graphics.print(window.width, window.width/2 + 100, window.height/2 + 50)
	love.graphics.print(window.height, window.width/2 + 100, window.height/2 + 100)


	-- draw to screen
	-- window scaling
	love.graphics.scale(window.scale)
	love.graphics.setCanvas()
	love.graphics.draw(canvas, 0, 0, 0, 1, 1)
end


-- graphics utility functions

function love.resize(w, h)
	resize(w, h)
end


function resize(w, h)
	local scale = h/window.height
	-- change virtual width to maintain square pixels with a 480px height in any aspect ratio
	window.width = window.height/h*w
	window.translateX = 0
	window.translateY = 0
	window.scale = scale

	canvas = love.graphics.newCanvas(window.width, window.height)
	canvas_sprite = menori.SpriteLoader.from_image(canvas)
	canvas_sprite.px, canvas_sprite.py = 0.0, 0.0

	if menori.app ~= nil then
		menori.app:handle_event('resize_camera', window.width, window.height, '...')
	end

end

-- input utility functions

function getMousePositionInWindow() -- get position of mouse in pixels
	local mx = math.floor((love.mouse.getX()-window.translateX)/window.scale+0.5)
	local my = math.floor((love.mouse.getY()-window.translateY)/window.scale+0.5)
	return mx, my
end

function love.mousemoved(...)

	menori.app:handle_event('mousemoved', getMousePositionInWindow())
end


