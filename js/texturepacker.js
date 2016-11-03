/**
 * @license
 * Pixi Texture Packer
 * Copyright (c) 2014, Sebastian Nette
 * http://www.mokgames.com/
 *
 * Pixi Texture Packer is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license.php
 */
 define(['text!config.json', 'pixi', 'algorithm/binpacker', 'jquery-ui'], function(config, PIXI, BinPacker) {

	var TexturePacker = Class.extend({

		init: function() {
			this.config = JSON.parse(config);

			this.packer = {
				binpacker: new BinPacker()
			};

			this.tests = {
				filereader: typeof FileReader !== undefined,
				dnd: 'draggable' in document.createElement('span'),
				formdata: !!window.FormData,
				progress: "upload" in new XMLHttpRequest
			};

			this.publishing = false;
			this.window = null;
			this.windows = {};
			this.input = {};

			this.frames = {};
			this.framecount = 0;

			this.selected = null;
			this.changed = false;
			this.nextpack = 0;
			this.throttle = 200;
			this.raf = null;

			this.scale = 0;
			this.width = 256;
			this.height = 256;

			this.createUi();
			this.createPIXI();
		},

		/**
		 *
		 */
		setChanged: function(bool)  {
			this.changed = bool;
			window.onbeforeunload = (this.changed ? function(e){
				return "You changed the file, are you sure you want to leave?";
			} : null);
		},

		/**
		 *
		 */
		tick: function() {
			requestAnimationFrame(this.tick.bind(this));
			this.renderer.render(this.stage);
		},

		/**
		 *
		 */
		render: function() {
			if(this.raf !== null) {
				cancelAnimationFrame(this.raf);
				this.raf = null;
			}
			if(this.nextpack <= $.now()) {
				this.pack();
			} else {
				this.raf = requestAnimationFrame(this.pack.bind(this));
			}
		},

		/**
		 *
		 */
		pack: function() {
			if(this.nextpack > $.now()) {
				this.raf = requestAnimationFrame(this.pack.bind(this));
				return;
			}

			// nothing to do here
			if(this.framecount === 0) {
				return;
			}

			// time til next render
			this.nextpack = $.now() + this.throttle;

			// trim images if needed
			if(this.input.trimmode.value === "trim") {
				_.each(this.frames, function(frame) {
					if(frame.trimmedSize.treshold !== this.input.trimtreshold.value) {
						frame.trimmedSize = this.trim(frame.can, this.input.trimtreshold.value);
					}
				}.bind(this));
			}

			// pack frames
			var packed = this.packer[this.input.algorithm.value].pack(this.frames, {
				powerOfTwo: (this.input.sizeconstraints.value === "pot"),
				padding: {
					border: this.input.borderpadding.value,
					shape: this.input.shapepadding.value,
					inner: this.input.innerpadding.value,
				},
				trim: (this.input.trimmode.value === "trim"),
				squared: this.input.squared.value,
				maxsize: { w: this.input.maxwidth.value, h: this.input.maxheight.value },
				fixed: { w: this.input.fixedwidth.value, h: this.input.fixedheight.value }
			});

			// align frames
			var skippedFrames = [];
			_.each(this.frames, function(frame, name) {
				if(packed.frames[name]) {
					this.frames[name].sprite.position.x = packed.frames[name].x;
					this.frames[name].sprite.position.y = packed.frames[name].y;
					this.frames[name].sprite.visible = true;
					this.frames[name].trimmed = packed.frames[name].trimmed;
					if(packed.frames[name].trimmed) {
						this.frames[name].sprite.position.x -= this.frames[name].trimmedSize.x;
						this.frames[name].sprite.position.y -= this.frames[name].trimmedSize.y;
					}
				} else {
					this.frames[name].sprite.visible = false;
					skippedFrames.push(name);
				}
			}.bind(this));

			// log skipped frames
			var log = (skippedFrames.length ? skippedFrames.length + " frames don't fit.<br /><br />" + skippedFrames.join("<br />") : "");
			this.workspace.sprites.find('div.logbox div.content').html(log);

			// resize stage 
			this.resizePixi(packed.width, packed.height);
			this.setChanged(true);
		},

		/**
		 *
		 */
		btn_hide_settings: function() {
			$('body').toggleClass("hidesettings");
		},

		/**
		 *
		 */
		btn_hide_sprites: function() {
			$('body').toggleClass("hidesprites");
		},
		
		/**
		 *
		 */
		btn_new: function() {
			if(!this.changed || confirm("Discard changes and create a new spritesheet?")) {
				this.setChanged(false);
				window.location.href = "./index.html";
			}
		},

		/**
		 *
		 */
		btn_delete: function(norender) {
			if(this.selected !== null) {
				this.frames[this.selected].dom.remove();
				this.container.removeChild(this.frames[this.selected].sprite);
				this.frames[this.selected].texture.destroy();
				delete this.frames[this.selected];
				this.selected = null;
				if(!norender) {
					this.render();
				}
				this.workspace.sprites.find('div.spritesbox div.content div').last().click();
				this.framecount--;
			}
		},

		/**
		 *
		 */
		btn_publish: function() {
			if(this.publishing || this.framecount === 0) { 
				return; 
			}
			this.publishing = true;

			$('#overlay').show();
			this.output.window.show();
			this.output.showjson.click();
			this.output.textarea.val("please wait...");

			/* snapshot stage... */
			var imgdata = this.snapshotStage();

			var separator = "", output = "{ \"frames\": {\n\n";
			var prepend = this.input.prepend.value;
			var dropext = this.input.dropext.value;
			_.each(this.frames, function(frame, name) {
				if(frame.sprite.visible) {
					if(dropext) {
						var ext = name.lastIndexOf('.');
						if(ext > -1)
							name = name.slice(0, ext);
					}
					output += separator;
					output += "\""+prepend+name+"\": {\n";
					output += "\t\"frame\": {";
					output += "\"x\":" + (frame.sprite.position.x + frame.trimmedSize.x) + ","; 
					output += "\"y\":" + (frame.sprite.position.y + frame.trimmedSize.y) + ","; 
					output += "\"w\":" + frame.trimmedSize.width + ","; 
					output += "\"h\":" + frame.trimmedSize.height; 
					output += "},\n";
					output += "\t\"rotated\": false,\n";
					output += "\t\"trimmed\": " + (frame.trimmed ? "true" : "false") + ",\n";
					output += "\t\"spriteSourceSize\": {";
					output += "\"x\":" + frame.trimmedSize.x + ","; 
					output += "\"y\":" + frame.trimmedSize.y + ","; 
					output += "\"w\":" + frame.trimmedSize.width + ","; 
					output += "\"h\":" + frame.trimmedSize.height;
					output += "},\n";
					output += "\t\"sourceSize\": {";
					output += "\"w\":" + frame.width + ","; 
					output += "\"h\":" + frame.height; 
					output += "}\n";
					output += "}";
					separator = ",\n";
				}
			});
			output += "\n},\n";
			output += "\"meta\": {\n";
			output += "\t\"app\": \"http://www.mokgames.com/texturepacker/\",\n";
			output += "\t\"version\": \"1.0\",\n";
			output += "\t\"image\": \"" + this.input.texturefile.value + "\",\n";
			output += "\t\"format\": \"RGBA8888\",\n";
			output += "\t\"size\": {\"w\":" + this.width + ",\"h\":" + this.height + "},\n";
			output += "\t\"scale\": " + this.input.scale.value + "\n";
			output += "}}";

			this.output.textarea.val(output).select();
			this.output.image.attr("src", imgdata);

			this.publishing = false;
			this.setChanged(false);
		},

		/**
		 * quite ugly, I need access to the json object so we load it twice, once with jquery, once with pixi
		 * we are grabbing the texture out of the pixi texture cache and create a non trimmed version
		 */
		load: function(url) {
			var scope = this;
			$.getJSON(url, function(json) {
				var loader = new PIXI.loaders.Loader();
				loader.add(url);
				loader.onComplete = function() {
					_.each(json.frames, function(frame, index) {
						var texture = PIXI.Texture.fromFrame(index),
							f = texture.frame,
							can = getCanvas(frame.sourceSize.w, frame.sourceSize.h);
						if(texture.trim) {
							can.context.drawImage(texture.baseTexture.source, f.x, f.y, f.width, f.height, texture.trim.x, texture.trim.y, f.width, f.height);
						} else {
							can.context.drawImage(texture.baseTexture.source, f.x, f.y, f.width, f.height, 0, 0, f.width, f.height);
						}
						scope.createFrame(index, can, frame.sourceSize.w, frame.sourceSize.h);
					});
				};
				loader.load();
			});
		},

		/**
		 * I tried to grab the stage canvas image data with the webgl renderer, but it didn't work,
		 * so we use the canvas renderer instead and create a rendered texture of the stage
		 */
		snapshotStage: function() {
			var can = getCanvas(this.width, this.height),
				renderTexture = new PIXI.RenderTexture(this.renderer, this.width, this.height);
				renderTexture.render(this.container),
				header = "image/png";

			// white background for jpegs
			if(this.input.txtformat.value === "jpg") {
				can.context.fillStyle = "rgb(255,255,255)";
				can.context.fillRect(0, 0, this.width, this.height);
				header = "image/jpeg";
			}
			can.context.drawImage(renderTexture.baseTexture.source, 0, 0, this.width, this.height);
			var imgdata = can.toDataURL(header, 1);
			renderTexture.destroy();
			return imgdata;
		},

		/**
		 * using the filereader api to "upload" the images, then render them on stage
		 */
		readFiles: function(files) {
			var formData = this.tests.formdata ? new FormData() : null;
			var scope = this;
			for (var i = 0; i < files.length; i++) {
				if(files[i].type === "image/png" || files[i].type === "image/jpeg" || files[i].type === "image/gif") {
					var reader = new FileReader();
					reader.onload = function (event) {
						var img = new Image(); 
						img.onload = function(){
							scope.createFrame(this.name, img, img.width, img.height);
						}.bind(this);
						img.src = event.target.result; 
					}.bind(files[i]);
					reader.readAsDataURL(files[i]);
				}
			}
		},

		/**
		 *
		 */
		createFrame: function(name, img, width, height) {

			var scope = this;
			this.framecount++;

			// frame already ecists, delete old version
			if(this.frames[name]) {
				var oldSelected = this.selected;
				this.selected = name;
				this.btn_delete(true);
				if(oldSelected !== name) {
					this.selected = oldSelected;
				}
			}

			var can = getCanvas(width, height),
				thumbnail = getCanvas(15, 15);
				can.context.drawImage(img, 0, 0),
				texture = PIXI.Texture.fromCanvas(can);

			// create thumbnail for spriteslist
			if(width > height) {
				thumbnail.width = 15;
				thumbnail.height = Math.round(height * 15/width);
			} else {
				thumbnail.width = Math.round(width * 15/height);
				thumbnail.height = 15;
			}
			thumbnail.context.drawImage(img, 0, 0, width, height, 0, 0, thumbnail.width, thumbnail.height);

			// add to frameslist
			this.frames[name] = {
				dom: $("<div>").html("<span><img src='" + thumbnail.toDataURL("image/png") + "' /></span>" + name).css("cursor", "pointer").click(function() {
					if(scope.selected && scope.selected !== name) {
						scope.frames[scope.selected].dom.removeClass("selected");
					}
					scope.selected = name;
					$(this).addClass("selected");
				}).dblclick(function() {
					$(this).html("<table><tr><td><span><img src='" + thumbnail.toDataURL("image/png") + "' /></span></td><td><input id='framename' type='text' value='" + name + "' /></td></tr></table>");
					function rename() {
						var newname = $(this).val();
						if(name === newname)
							return;
						scope.selected = name;
						scope.btn_delete(true);
						scope.createFrame(newname, img, width, height);
					}
					$("#framename").focus().select().focusout(rename).keypress(function(e) { if(e.which == 13) rename.call(this); });
				}),
				can: can,
				texture: texture,
				sprite: new PIXI.Sprite(texture),
				width: width,
				height: height,
				trimmedSize: this.trim(can, this.input.trimtreshold.value)
			};

			// add sprite to stage
			this.frames[name].sprite.visible = false;
			this.container.addChild(this.frames[name].sprite);

			// add sprite to sprites list
			this.workspace.sprites.find('div.spritesbox div.content').append(this.frames[name].dom);
			this.frames[name].dom.click();

			// render stage
			this.render();
		},

		/**
		 * trims transparent pixels
		 */
		trim: function trim(can, treshold) {
			var alpha = Math.max(1, treshold);
			var sourceData = can.context.getImageData(0, 0, can.width, can.height);
			var sourcePixels = sourceData.data;
			var bound = [can.width, can.height, 0, 0];
			for (var i = 0, len = sourcePixels.length; i < len; i += 4) {
				if (sourcePixels[i + 3] < alpha) {
					continue;
				}
				var x = (i / 4 | 0) % can.width | 0;
				var y = (i / 4 | 0) / can.width | 0;
				if (x < bound[0]) { bound[0] = x; }
				if (x > bound[2]) { bound[2] = x; }
				if (y < bound[1]) { bound[1] = y; }
				if (y > bound[3]) { bound[3] = y; }
			}

			var data = { 
				trimmed: false, 
				treshold: alpha,
				x: 0,
				y: 0,
				width: can.width,
				height: can.height
			};
			if (bound[2] !== can.width-1 || bound[3] !== can.height-1) {
				data = { 
					trimmed: true, 
					treshold: alpha, 
					width: bound[2] - bound[0] + 1, 
					height: bound[3] - bound[1] + 1, 
					x: bound[0], 
					y: bound[1]
				};
			}
			return data;
		},

		/**
		 *
		 */
		showWindow: function(id, type) {
			if(type === "click" && this['btn_' + id] !== undefined && _.isFunction(this['btn_' + id])) {
				this['btn_' + id]();
				return;
			}
			if(type === "mouseover") {
				if(!this.window || this.window.id === id || this.windows[id] === undefined || this.windows[id].parent !== this.window.parent) {
					return;
				}
			}
			if(this.window) {
				this.window.element.hide();
				if(this.window.id === id) {
					this.window = null;
					return;
				}
			}
			if(this.windows[id] !== undefined) {
				this.window = {
					element: this.windows[id].element.css({
						left: this.windows[id].item.position().left,
						top: this.windows[id].item.position().top + this.windows[id].item.height() + (this.windows[id].element.hasClass("wmenubar") ? 2 : 6)
					}).show(),
					parent: this.windows[id].parent,
					time: $.now() + 100,
					id: id
				};
			}
		},

		/**
		 *
		 */
		createUi: function() {
			var scope = this;
			this.menubar = $('#menubar');
			this.toolbar = $('#toolbar');
			this.workspace = {
				settings: $('#settings'),
				sprites: $('#sprites'),
				main: $('#main'),
				spritesheet: $('#spritesheet'),
				zoomcontrol: $('#zoomcontrol')
			};
			this.canvas = this.workspace.spritesheet.find('.canvas').css("transform-origin", "left top");
			this.zoomlevel = this.workspace.zoomcontrol.find('.zoomlvl span');
			this.size = this.workspace.zoomcontrol.find('.size span');
			
			// texture packer like image drop
			if (this.tests.dnd) {
				this.workspace.spritesheet[0].ondragover = function () { return false; };
				this.workspace.spritesheet[0].ondragend = function () { return false; };
				this.workspace.spritesheet[0].ondrop = function (e) {
					e.preventDefault();
					scope.readFiles(e.dataTransfer.files);
				};	
			}

			// parse menubar
			_.each(this.config.menubar, function(item) {
				var menuitem = $('<span>').css("cursor", "pointer").text(item.text).appendTo(scope.menubar);
				menuitem.click(function() { scope.showWindow(item.id, "click"); });
				menuitem.mouseover(function() { scope.showWindow(item.id, "mouseover"); });

				// store window
				scope.windows[item.id] = {
					element: $('<div>').attr("class", "window wmenubar").hide().appendTo('body'),
					parent: "menubar",
					item: menuitem
				};

				// window elements
				_.each(item.menu, function(subitem) {
					$('<div>').css("cursor", "pointer").addClass(subitem.id).text(subitem.text).appendTo(scope.windows[item.id].element).click(function() {
						scope.showWindow(subitem.id, "click");
					});
				});
			});

			// parse toolbar
			_.each(this.config.toolbar, function(item) {
				var menuitem = $('<div>').css("cursor", "pointer").html('<img src="' + item.img + '" /><br />' + item.text).appendTo(scope.toolbar);
				menuitem.click(function() { scope.showWindow(item.id, "click"); });
				menuitem.mouseover(function() { scope.showWindow(item.id, "mouseover"); });

				// store window
				if(item.window) {
					scope.windows[item.id] = {
						element: $('#toolbar_' + item.id),
						parent: "toolbar",
						item: menuitem
					};
				}
			});

			// add sprites window
			var file = this.windows.add.element.find("input.file");
			var json = this.windows.add.element.find("input.json");
			this.windows.add.element.find("input.add").click(function() {
				if(json.val().indexOf(".json") > -1) {
					scope.load(json.val());
				}
				if(file[0].files) {
					scope.readFiles(file[0].files);
				}
				json.val("http://");
				file.val("");
			});

			// workspace
			_.each(this.config.workspace, function(item) {
				var box = $('<div>').addClass(item.id + "box").appendTo(scope.workspace[item.parent]);
				var headline = $('<div>').attr("class", "headline").text(item.text).appendTo(box);
				var content = $('<div>').attr("class", "content").appendTo(box);
				var image = $('<img>').attr("src", "img/minus.png").css("float", "right").appendTo(headline);
				headline.css("cursor", "pointer").click(function() {
					if(image.hasClass("collapsed")) {
						image.removeClass("collapsed").attr("src", "img/minus.png");
						content.show(300);
					} else {
						image.addClass("collapsed").attr("src", "img/plus.png");
						content.hide(300);
					}
				});

				if(item.menu) {
					var table = $('<table width="100%" cellspacing="10" cellpadding="0" border="0">').appendTo(content);
					_.each(item.menu, function(subitem) {
						var tr = $('<tr valign="middle">').appendTo(table);
						tr.append($('<td align="right">').text(subitem.text));
						var td = $('<td align="left" width="50%">').appendTo(tr);
						if(subitem.type === "text") {
							scope.input[subitem.id] = {
								element: $('<input type="text" value="" />').val(subitem.value).appendTo(td),
								value: subitem.value
							};
							scope.input[subitem.id].element.bind('keyup change', function() {
								scope.input[subitem.id].value = $(this).val();
								if(subitem.render) { scope.render(); }
							});
						} else if(subitem.type === "float") {
							scope.input[subitem.id] = {
								element: $('<input type="text" value="" />').val(subitem.value).appendTo(td),
								value: subitem.value
							}; 
							scope.input[subitem.id].element.bind('keyup change', function() {
								var value = $(this).val().replace(/[^0-9.]/g, '');
								if(value !== $(this).val()) {
									$(this).val(scope.input[subitem.id].value);
									return;
								}
								value = parseFloat(value || 1) || 0.1;
								if(value < subitem.min) {
									value = subitem.min;
								}
								if(subitem.max && value > subitem.max) {
									value = subitem.max;
									$(this).val(value);
								}
								scope.input[subitem.id].value = value;
								if(subitem.render) { scope.render(); }
							});
						} else if(subitem.type === "int") {
							scope.input[subitem.id] = {
								element: $('<input type="text" value="" />').val(subitem.value).appendTo(td),
								value: (subitem.value === "" ? -1 : subitem.value)
							};
							scope.input[subitem.id].element.bind('keyup change', function() {
								var value = $(this).val().replace(/[^0-9]/g, '');
								if(value !== $(this).val()) {
									if(scope.input[subitem.id].value >= 0) {
										$(this).val(scope.input[subitem.id].value);
									} else {
										$(this).val("");
									}
									return;
								}
								if(value === "" && (subitem.id === "fixedwidth" || subitem.id === "fixedheight")) {
									scope.input[subitem.id].value = -1;
								} else {
									value = parseInt(value || 0, 10);
									if(value < subitem.min) {
										value = subitem.min;
										if(value >= 0) {
											$(this).val(value);
										}
									}
									if(subitem.max && value > subitem.max) {
										value = subitem.max;
										$(this).val(value);
									}
									scope.input[subitem.id].value = value;
								}
								if(subitem.render) { scope.render(); }
							});
						} else if(subitem.type === "select") {
							scope.input[subitem.id] = {
								element: $('<select>').appendTo(td),
								value: subitem.value
							};
							_.each(subitem.values, function(option) {
								scope.input[subitem.id].element.append($("<option>", { value: option[0], text: option[1] }));
							});
							scope.input[subitem.id].element.val(subitem.value).change(function() {
								scope.input[subitem.id].value = $(this).val();
								if(subitem.render) { scope.render(); }
							});
						} else if(subitem.type === "checkbox") {
							scope.input[subitem.id] = {
								element: $('<input type="checkbox" value="1" />').prop('checked', subitem.checked).appendTo(td),
								value: subitem.checked
							};
							scope.input[subitem.id].element.change(function() {
								scope.input[subitem.id].value = $(this).prop('checked');
								if(subitem.render) { scope.render(); }
							});
						}
					});
				}
			});

			// zoom control
			this.zoomScale = 1;
			this.workspace.zoomcontrol.find('.minus').css("cursor", "pointer").click(function() { 
				scope.zoomslider.slider("value", scope.zoomScale - 0.1); 
			});
			this.workspace.zoomcontrol.find('.plus').css("cursor", "pointer").click(function() { 
				scope.zoomslider.slider("value", scope.zoomScale + 0.1); 
			});
			this.workspace.zoomcontrol.find('.reset').css("cursor", "pointer").click(function() { 
				scope.zoomslider.slider("value", 1); 
			});
			this.zoomslider = this.workspace.zoomcontrol.find('.slider').slider({ min: 0.1, max: 10, step: 0.1, value: 1, change: function(event, ui) {
				scope.zoomScale = ui.value;
				scope.zoomlevel.text(ui.value);
				scope.canvas.css("transform", "scale(" + ui.value + ")");
			}, slide: function( event, ui ) {
				scope.zoomScale = ui.value;
				scope.zoomlevel.text(ui.value);
				scope.canvas.css("transform", "scale(" + ui.value + ")");
			}});

			// done loading
			$('#loading').remove();
			$('#page').show().click(function() {
				if(scope.window && scope.window.time < $.now()) {
					scope.window.element.hide();
					scope.window = null;
				}
			});

			// output
			this.output = {};
			this.output.window = $('#output');
			this.output.textarea = this.output.window.find('textarea');
			this.output.image = this.output.window.find('img');
			this.output.close = this.output.window.find('input.close');
			this.output.showjson = this.output.window.find('input.showjson');
			this.output.showimage = this.output.window.find('input.showimage');
			this.output.showjson.click(function() {
				scope.output.textarea.show();
				scope.output.image.hide();
			});
			this.output.showimage.click(function() {
				scope.output.textarea.hide();
				scope.output.image.show();
			});
			this.output.close.click(function() {
				scope.output.window.hide();
				$('#overlay').hide();
			});
		},

		/**
		 *
		 */
		createPIXI: function() {
			this.stage = new PIXI.Container();
			this.renderer = PIXI.autoDetectRenderer(this.width, this.height, {transparent: true}, true);

			this.canvas.append(this.renderer.view).css({
				width: this.width + 2, 
				height: this.height + 2 
			});

			this.container = new PIXI.Container();
			this.stage.addChild(this.container);
			
			this.tick();
		},

		/**
		 *
		 */
		resizePixi: function(width, height) {

			scale = this.input.scale.value;
			height = Math.round(height * scale);
			width = Math.round(width * scale);

			this.container.scale.x = this.input.scale.value;
			this.container.scale.y = this.input.scale.value;

			if(width !== this.width || height !== this.height || this.scale !== scale) {
				this.scale = scale;
				this.width = width;
				this.height = height;
				this.renderer.resize(width, height);
				this.canvas.css({ width: width + 2, height: height + 2 });
				this.size.text(width + "px x " + height + "px");
			}
		},

		/**
		 *
		 */
		resizeUi: function() {
			var height = $(window).innerHeight(),
				css = { height: height - this.menubar.height() - this.toolbar.height() - 28 };

			this.workspace.settings.css(css);
			this.workspace.sprites.css(css);
			this.workspace.main.css(css);

			this.workspace.spritesheet.css({
				"height": css.height - this.workspace.zoomcontrol.height(),
				"max-height": css.height - this.workspace.zoomcontrol.height()
			});
		}

	});

	$(document).ready(function() {
		var packer = new TexturePacker();
		$(window).resize(packer.resizeUi.bind(packer));
		packer.resizeUi();
	});

});
