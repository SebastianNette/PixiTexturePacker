/**
 * modified version of bin packing algorithm 
 * Copyright (c) 2014 Sebastian Nette
 * 
 * Original code @ https://github.com/jakesgordon/bin-packing
 * Copyright (c) 2011, 2012, 2013 Jake Gordon and contributors
 *
 * @MIT License.
 * http://www.opensource.org/licenses/mit-license.php
*/

define([], function() {

	var BinPacker = Class.extend({
		
		init: function() {
		},

		pack: function(frames, options) {

			this.frames = {};
			this.options = options;
			this.width = 0;
			this.height = 0;

			this.options.padding.border -= this.options.padding.inner;
			if(this.options.padding.border < 0) {
				this.options.padding.border = 0;
			}

			if(this.options.powerOfTwo) {
				this.options.maxsize.w = this.powerOfTwo(this.options.maxsize.w) || 2;
				this.options.maxsize.h = this.powerOfTwo(this.options.maxsize.h) || 2;
			}

			if(this.options.fixed.w >= 1) { 
				this.options.maxsize.w = this.options.fixed.w; 
			}

			if(this.options.fixed.h >= 1) {
				this.options.maxsize.h = this.options.fixed.h; 
			}

			var blocks = this.toBlocks(frames).sort(function(a, b) {
				return this.maxside(a, b);
			}.bind(this));

			this.fit(blocks);
			
			for(var n = 0 ; n < blocks.length ; n++) {
				var block = blocks[n];
				if (block.fit) {
					this.frames[block.frame] = {
						x: block.fit.x + this.options.padding.border + this.options.padding.inner,
						y: block.fit.y + this.options.padding.border + this.options.padding.inner,
						w: block.fit.w,
						h: block.fit.h,
						trimmed: block.t
					};
					this.width = Math.max(this.width, this.frames[block.frame].x + block.w);
					this.height = Math.max(this.height, this.frames[block.frame].y + block.h);
				} else {
					this.frames[block.frame] = null;
				}
			}

			this.width += this.options.padding.border - this.options.padding.shape;
			this.height += this.options.padding.border - this.options.padding.shape;

			if(this.options.powerOfTwo) {
				this.width = this.powerOfTwo(this.width) || 2;
				this.height = this.powerOfTwo(this.height) || 2;
			}

			if(this.options.squared) {
				if(this.height > this.width) {
					this.width = this.height;
				} else {
					this.height = this.width;
				}
			}

			if(this.options.fixed.w >= 1) { this.width = this.options.fixed.w; }
			if(this.options.fixed.h >= 1) { this.height = this.options.fixed.h; }

			return { frames: this.frames, width: this.width, height: this.height };
		},

		powerOfTwo: function(n) {
			var i = 0, s = 0;
			while (s === 0) {
				if(n <= Math.pow(2,i)) {
					s = Math.pow(2,i);
				}
				i++;
			}
			return s;
		},

		toBlocks: function (frames) {
			var blocks = [];
			_.each(frames, function (frame, index) {
				var block = { 
					frame: index, 
					w: ((this.options.trim && frame.trimmedSize.trimmed) ? frame.trimmedSize.width : frame.width) + this.options.padding.shape + 2 * this.options.padding.inner, 
					h: ((this.options.trim && frame.trimmedSize.trimmed) ? frame.trimmedSize.height : frame.height) + this.options.padding.shape + 2 * this.options.padding.inner,
					t: (this.options.trim && frame.trimmedSize.trimmed),
					num: 1 
				};
				if((block.w + 2 * this.options.padding.border) <= this.options.maxsize.w && (block.h + 2 * this.options.padding.border) <= this.options.maxsize.h) {
					blocks.push(block);
				}
			}.bind(this));
			return blocks;
		},

		w: function (a, b) { 
			return b.w - a.w; 
		},
		
		h: function (a, b) { 
			return b.h - a.h; 
		},
		
		max: function (a, b) { 
			return Math.max(b.w, b.h) - Math.max(a.w, a.h); 
		},
		
		min: function (a, b) { 
			return Math.min(b.w, b.h) - Math.min(a.w, a.h); 
		},

		maxside: function (a,b) { 
			return this.msort(a, b, ["max", "min", "h", "w"]); 
		},

		msort: function(a, b, criteria) {
			var diff, n;
			for (n = 0 ; n < criteria.length ; n++) {
				if(criteria[n] === "max") {
					diff = this.max(a, b);
				} else if(criteria[n] === "min") {
					diff = this.min(a, b);
				} else if(criteria[n] === "h") {
					diff = this.h(a, b);
				} else if(criteria[n] === "w") {
					diff = this.w(a, b);
				}
				if (diff != 0) {
					return diff;  
				}
			}
			return 0;
		},

		fit: function(blocks) {
			var n, node, block, len = blocks.length;
			var w = len > 0 ? blocks[0].w : 0;
			var h = len > 0 ? blocks[0].h : 0;
			this.root = { x: 0, y: 0, w: w, h: h };
			for (n = 0; n < len ; n++) {
				block = blocks[n];
				if (node = this.findNode(this.root, block.w, block.h)) {
					block.fit = this.splitNode(node, block.w, block.h);
				} else {
					block.fit = this.growNode(block.w, block.h);
				}
			}
		},

		findNode: function(root, w, h) {
			if (root.used) {
				return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
			} else if ((w <= root.w) && (h <= root.h)) {
				return root;
			} else {
				return null;
			}
		},

		splitNode: function(node, w, h) {
			node.used = true;
			node.down  = { x: node.x,     y: node.y + h, w: node.w,     h: node.h - h };
			node.right = { x: node.x + w, y: node.y,     w: node.w - w, h: h          };
			return node;
		},

		growNode: function(w, h) {
			var canGrowDown  = (w <= this.root.w);
			var canGrowRight = (h <= this.root.h);

			var shouldGrowRight = canGrowRight && (this.root.h >= (this.root.w + w));
			var shouldGrowDown  = canGrowDown  && (this.root.w >= (this.root.h + h));

			// dirty
			if(this.options.powerOfTwo) {
				var pot = this.powerOfTwo(this.root.w) + 2 * this.options.padding.border - this.options.padding.shape;
				if((this.root.w + w + 2 * this.options.padding.border) > pot && (this.root.h + h + 2 * this.options.padding.border) <= (pot*2) && canGrowDown) {
					shouldGrowDown = true;
					shouldGrowRight = false;
				}
			}
			if((this.root.w + w + 2 * this.options.padding.border) > this.options.maxsize.w) {
				shouldGrowRight = false;
				canGrowRight = false;
			}
			if((this.root.h + h + 2 * this.options.padding.border) > this.options.maxsize.h) {
				shouldGrowDown = false;
				canGrowDown = false;
			}

			if (shouldGrowRight) {
				return this.growRight(w, h);
			} else if (shouldGrowDown) {
				return this.growDown(w, h);
			} else if (canGrowRight) {
				return this.growRight(w, h);
			} else if (canGrowDown) {
				return this.growDown(w, h);
			} else {
				return null;
			}
		},

		growRight: function(w, h) {
			this.root = {
				used: true,
				x: 0,
				y: 0,
				w: this.root.w + w,
				h: this.root.h,
				down: this.root,
				right: { x: this.root.w, y: 0, w: w, h: this.root.h }
			};
			if (node = this.findNode(this.root, w, h)) {
				return this.splitNode(node, w, h);
			} else {
				return null;
			}
		},

		growDown: function(w, h) {
			this.root = {
				used: true,
				x: 0,
				y: 0,
				w: this.root.w,
				h: this.root.h + h,
				down:  { x: 0, y: this.root.h, w: this.root.w, h: h },
				right: this.root
			};
			if (node = this.findNode(this.root, w, h)) {
				return this.splitNode(node, w, h);
			} else {
				return null;
			}
		}

	});

	return BinPacker;

});
