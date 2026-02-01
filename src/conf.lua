function love.conf(t)
	-- window setup
	-- default scaling is 1:1
	t.window.width = 640
	t.window.height = 480

	if love._version_major > 11 then
		t.window.depth = true
	else
		t.window.depth = 24
	end

	t.window.title = "Skyfire"
	t.window.vsync = true
	t.highdpi = true

	t.console = true
end