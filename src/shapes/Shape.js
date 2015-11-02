import {
    mod,
    each,
    getValue,
    getNumber,
    createSvgElement
} from '../common/utils';

import Base       from '../lib/Base';
import Rectangle  from '../lib/Rectangle';
import styleNames from '../enums/styleNames';
import directions from '../enums/directions';

var Shape = Base.extend({

    pointerEvents: true,
    svgPointerEvents: 'all',
    svgStrokeTolerance: 8,
    shapePointerEvents: false,
    stencilPointerEvents: false,

    scale: 1,
    rotation: 0,
    opacity: 100,       // 透明度
    strokeWidth: 1,     // 边框宽度
    flipH: false,       // 水平翻转
    flipV: false,       // 垂直翻转
    visible: true,      // 默认可见
    outline: false,
    antiAlias: true,    // 抗锯齿，平滑处理


    constructor: function Shape() {

        //var that = this;

        // props
        // -----
        // that.node = null;        // 图形的根节点，通常是 g 元素
        // that.state = null;
        // that.style = null;
        // that.points = null;      // 绘制连线需要的点
        // that.bounds = null;      // 表示该图形的区域范围
        // that.boundingBox = null; // 图形的边框
    },

    apply: function (state) {

        var that = this;

        that.state = state;
        var style = that.style = state.style;

        if (style) {
            // 背景
            that.fillColor = getValue(style, styleNames.fillColor, that.fillColor);
            that.gradientColor = getValue(style, styleNames.gradientColor, that.gradientColor);
            that.gradientDirection = getValue(style, styleNames.gradientDirection, that.gradientDirection);
            that.opacity = getValue(style, styleNames.opacity, that.opacity);
            // 边框
            that.strokeColor = getValue(style, styleNames.strokeColor, that.strokeColor);
            that.strokeWidth = getNumber(style, styleNames.strokeWidth, that.strokeWidth);
            that.arrowStrokeWidth = getNumber(style, styleNames.strokeWidth, that.strokeWidth);
            that.spacing = getValue(style, styleNames.spacing, that.spacing);
            that.startSize = getNumber(style, styleNames.startSize, that.startSize);
            that.endSize = getNumber(style, styleNames.endSize, that.endSize);
            that.startArrow = getValue(style, styleNames.startArrow, that.startArrow);
            that.endArrow = getValue(style, styleNames.endArrow, that.endArrow);
            that.rotation = getValue(style, styleNames.rotation, that.rotation);
            that.direction = getValue(style, styleNames.direction, that.direction);
            that.flipH = getValue(style, styleNames.flipH, 0) === 1;
            that.flipV = getValue(style, styleNames.flipV, 0) === 1;


            if (that.direction === directions.north || that.direction === directions.south) {
                var tmp = that.flipH;
                that.flipH = that.flipV;
                that.flipV = tmp;
            }

            that.isShadow = getValue(style, styleNames.shadow, that.isShadow) === 1;
            that.isDashed = getValue(style, styleNames.dashed, that.isDashed) === 1;
            that.isRounded = getValue(style, styleNames.rounded, that.isRounded) === 1;
            that.glass = getValue(style, styleNames.glass, that.glass) === 1;


            //if (that.fillColor === constants.NONE) {
            //    that.fillColor = null;
            //}
            //
            //if (that.gradientColor === constants.NONE) {
            //    that.gradientColor = null;
            //}
            //
            //if (that.strokeColor === constants.NONE) {
            //    that.strokeColor = null;
            //}
        }

        return that;
    },

    init: function (container) {

        var that = this;
        var node = that.node || that.create(container);

        if (node && container) {
            that.node = node;
            container.appendChild(node);
        }

        return that;
    },

    create: function (container) {
        if (container && container.ownerSVGElement) {
            return createSvgElement('g');
        }
    },

    clear: function () {

        var that = this;
        var node = that.node;

        if (node && node.ownerDocument) {
            while (node.lastChild) {
                node.removeChild(node.lastChild);
            }
        }

        return that;
    },

    getScreenOffset: function () {

        var that = this;
        var strokeWidth = that.strokeWidth;
        //var strokeWidth = that.stencil && that.stencil.strokeWidth !== 'inherit'
        //    ? that.stencil.strokeWidth
        //    : that.strokeWidth;

        strokeWidth = Math.max(1, Math.round(strokeWidth * that.scale));

        return mod(strokeWidth, 2) === 1 ? 0.5 : 0;
    },

    redraw: function () {

        var that = this;
        var node = that.node;

        // 对于连线，需要根据 points 来计算出连线的 bounds
        that.updateBoundsFromPoints();

        if (that.visible && that.checkBounds()) {
            node.style.visibility = 'visible';
            that.clear(); // 删除根节点下的所有子元素
            that.redrawShape();
            that.updateBoundingBox();
        } else {
            node.style.visibility = 'hidden';
            that.boundingBox = null;
        }

        return that;
    },

    redrawShape: function () {

        var that = this;
        var canvas = that.createCanvas();

        if (canvas) {
            canvas.pointerEvents = that.pointerEvents;

            that.draw(canvas);
            that.destroyCanvas(canvas);
        }

        return that;
    },

    draw: function (canvas) {

        var that = this;
        var bounds = that.bounds;

        // Scale is passed-through to canvas
        var scale = that.scale;
        var x = bounds.x / scale;
        var y = bounds.y / scale;
        var w = bounds.width / scale;
        var h = bounds.height / scale;

        if (that.isPaintBoundsInverted()) {

            var t = (w - h) / 2;
            x += t;
            y -= t;

            var tmp = w;
            w = h;
            h = tmp;
        }

        that.updateTransform(canvas, x, y, w, h);
        that.configureCanvas(canvas, x, y, w, h);

        // Adds background rectangle to capture events
        var bg = null;

        if ((!that.stencil && !that.points && that.shapePointerEvents) ||
            (that.stencil && that.stencilPointerEvents)) {

            var bb = that.createBoundingBox();

            bg = that.createTransparentSvgRectangle(bb.x, bb.y, bb.width, bb.height);
            that.node.appendChild(bg);
        }


        if (that.stencil) {
            that.stencil.drawShape(canvas, that, x, y, w, h);
        } else {
            // Stencils have separate strokeWidth
            canvas.setStrokeWidth(that.strokeWidth);

            if (that.points) {
                var pts = [];
                for (var i = 0; i < that.points.length; i++) {
                    if (that.points[i]) {
                        pts.push(new Point(that.points[i].x / scale, that.points[i].y / scale));
                    }
                }

                that.paintEdgeShape(canvas, pts);
            } else {
                that.paintVertexShape(canvas, x, y, w, h);
            }
        }

        if (bg && canvas.state && canvas.state.transform) {
            bg.setAttribute('transform', canvas.state.transform);
        }
    },

    drawNode: function (c, x, y, w, h) {
        this.drawNodeBackground(c, x, y, w, h);
        c.setShadow(false);
        this.drawNodeForeground(c, x, y, w, h);
    },

    // 绘制 node 背景
    drawNodeBackground: function (c, x, y, w, h) { },

    // 绘制 node 前景
    drawNodeForeground: function (c, x, y, w, h) { },

    drawLink: function (c, pts) {},

    paintGlassEffect: function (c, x, y, w, h, arc) {
        var sw = Math.ceil(this.strokeWidth / 2);
        var size = 0.4;

        c.setGradient('#ffffff', '#ffffff', x, y, w, h * 0.6, 'south', 0.9, 0.1);
        c.begin();
        arc += 2 * sw;

        if (this.isRounded) {
            c.moveTo(x - sw + arc, y - sw);
            c.quadTo(x - sw, y - sw, x - sw, y - sw + arc);
            c.lineTo(x - sw, y + h * size);
            c.quadTo(x + w * 0.5, y + h * 0.7, x + w + sw, y + h * size);
            c.lineTo(x + w + sw, y - sw + arc);
            c.quadTo(x + w + sw, y - sw, x + w + sw - arc, y - sw);
        }
        else {
            c.moveTo(x - sw, y - sw);
            c.lineTo(x - sw, y + h * size);
            c.quadTo(x + w * 0.5, y + h * 0.7, x + w + sw, y + h * size);
            c.lineTo(x + w + sw, y - sw);
        }

        c.close();
        c.fill();
    },

    addPoints: function (c, pts, rounded, arcSize, close) {
        var pe = pts[pts.length - 1];

        // Adds virtual waypoint in the center between start and end point
        if (close && rounded) {
            pts = pts.slice();
            var p0 = pts[0];
            var wp = new Point(pe.x + (p0.x - pe.x) / 2, pe.y + (p0.y - pe.y) / 2);
            pts.splice(0, 0, wp);
        }

        var pt = pts[0];
        var i = 1;

        // Draws the line segments
        c.moveTo(pt.x, pt.y);

        while (i < ((close) ? pts.length : pts.length - 1)) {
            var tmp = pts[mxUtils.mod(i, pts.length)];
            var dx = pt.x - tmp.x;
            var dy = pt.y - tmp.y;

            if (rounded && (dx != 0 || dy != 0)) {
                // Draws a line from the last point to the current
                // point with a spacing of size off the current point
                // into direction of the last point
                var dist = Math.sqrt(dx * dx + dy * dy);
                var nx1 = dx * Math.min(arcSize, dist / 2) / dist;
                var ny1 = dy * Math.min(arcSize, dist / 2) / dist;

                var x1 = tmp.x + nx1;
                var y1 = tmp.y + ny1;
                c.lineTo(x1, y1);

                // Draws a curve from the last point to the current
                // point with a spacing of size off the current point
                // into direction of the next point
                var next = pts[mxUtils.mod(i + 1, pts.length)];

                // Uses next non-overlapping point
                while (i < pts.length - 2 && Math.round(next.x - tmp.x) == 0 && Math.round(next.y - tmp.y) == 0) {
                    next = pts[mxUtils.mod(i + 2, pts.length)];
                    i++;
                }

                dx = next.x - tmp.x;
                dy = next.y - tmp.y;

                dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                var nx2 = dx * Math.min(arcSize, dist / 2) / dist;
                var ny2 = dy * Math.min(arcSize, dist / 2) / dist;

                var x2 = tmp.x + nx2;
                var y2 = tmp.y + ny2;

                c.quadTo(tmp.x, tmp.y, x2, y2);
                tmp = new Point(x2, y2);
            }
            else {
                c.lineTo(tmp.x, tmp.y);
            }

            pt = tmp;
            i++;
        }

        if (close) {
            c.close();
        }
        else {
            c.lineTo(pe.x, pe.y);
        }
    },

    updateBoundsFromPoints: function () {

        var that = this;
        var bounds;

        each(that.points || [], function (point, index) {

            var rect = new Rectangle(point.x, point.y, 1, 1);

            if (index === 0) {
                that.bounds = bounds = rect;
            } else {
                bounds.add(rect);
            }
        });

        return that;
    },

    checkBounds: function () {

        var bounds = this.bounds;

        return bounds
            && !isNaN(bounds.x)
            && !isNaN(bounds.y)
            && !isNaN(bounds.width)
            && !isNaN(bounds.height)
            && bounds.width > 0
            && bounds.height > 0;
    },

    getLabelBounds: function (rect) {
        return rect;
    },

    getGradientBounds: function (c, x, y, w, h) {
        return new Rectangle(x, y, w, h);
    },

    // 圆弧尺寸
    getArcSize: function (w, h) {
        var f = getValue(this.style, constants.STYLE_ARCSIZE,
                constants.RECTANGLE_ROUNDING_FACTOR * 100) / 100;
        return Math.min(w * f, h * f);
    },

    createBoundingBox: function () {

        var bb = this.bounds.clone();

        if ((this.stencil && (this.direction === constants.DIRECTION_NORTH ||
            this.direction === constants.DIRECTION_SOUTH)) || this.isPaintBoundsInverted()) {
            bb.rotate90();
        }

        return bb;
    },

    updateBoundingBox: function () {
        if (this.bounds) {
            var boundingBox = this.createBoundingBox();

            if (boundingBox != null) {
                this.augmentBoundingBox(boundingBox);
                var rot = this.getShapeRotation();

                if (rot != 0) {
                    boundingBox = mxUtils.getBoundingBox(boundingBox, rot);
                }
            }

            this.boundingBox = boundingBox;
        }
    },

    augmentBoundingBox: function (bbox) {
        if (this.isShadow) {
            bbox.width += Math.ceil(constants.SHADOW_OFFSET_X * this.scale);
            bbox.height += Math.ceil(constants.SHADOW_OFFSET_Y * this.scale);
        }

        // Adds strokeWidth
        bbox.grow(this.strokeWidth * this.scale / 2);
    },

    updateTransform: function (canvas, x, y, w, h) {

        var shape = this;

        canvas.scale(shape.scale);
        canvas.rotate(shape.getShapeRotation(), shape.flipH, shape.flipV, x + w / 2, y + h / 2);

        return shape;
    },

    createCanvas: function () {

        var that = this;
        var node = that.node;
        var canvas = new Canvas2D(node, false);

        canvas.strokeTolerance = that.pointerEvents ? that.svgStrokeTolerance : 0;
        canvas.pointerEventsValue = that.svgPointerEvents;
        canvas.blockImagePointerEvents = false;//mxClient.IS_FF;
        canvas.antiAlias = that.antiAlias; // 抗锯齿

        var off = that.getScreenOffset();

        if (off === 0) {
            node.removeAttribute('transform');
        } else {
            node.setAttribute('transform', 'translate(' + off + ',' + off + ')');
        }

        if (that.outline) {
            canvas.setStrokeWidth(this.strokeWidth);
            canvas.setStrokeColor(this.stroke);

            if (this.isDashed !== null) {
                canvas.setDashed(this.isDashed);
            }

            canvas.setStrokeWidth = function () {};
            canvas.setStrokeColor = function () {};
            canvas.setFillColor = function () {};
            canvas.setGradient = function () {};
            canvas.setDashed = function () {};
        }

        return canvas;
    },

    configureCanvas: function (canvas, x, y, w, h) {
        var dash;

        if (this.style) {
            dash = this.style['dashPattern'];
        }

        canvas.setAlpha(this.opacity / 100);

        // Sets alpha, colors and gradients
        if (this.isShadow != null) {
            canvas.setShadow(this.isShadow);
        }

        // Dash pattern
        if (this.isDashed != null) {
            canvas.setDashed(this.isDashed);
        }

        if (dash != null) {
            canvas.setDashPattern(dash);
        }

        if (this.fill != null && this.fill != constants.NONE && this.gradient && this.gradient != constants.NONE) {
            var b = this.getGradientBounds(canvas, x, y, w, h);
            canvas.setGradient(this.fill, this.gradient, b.x, b.y, b.width, b.height, this.gradientDirection);
        }
        else {
            canvas.setFillColor(this.fill);
        }

        canvas.setStrokeColor(this.stroke);
    },

    destroyCanvas: function (canvas) {

        each(canvas.gradients, function (gradient) {
            gradient.mxRefCount = (gradient.mxRefCount || 0) + 1;
        });
        this.releaseSvgGradients(this.oldGradients);
        this.oldGradients = canvas.gradients;
    },

    setCursor: function (cursor) {

        var shape = this;
        var node = shape.node;

        cursor = cursor || '';

        shape.cursor = cursor;

        if (node) {
            node.style.cursor = cursor;
        }

        return shape;
    },

    getCursor: function () {
        return this.cursor;
    },

    getRotation: function () {
        var rotation = this.rotation;
        return isNullOrUndefined(rotation) ? 0 : rotation;
    },

    getTextRotation: function () {
        var rot = this.getRotation();

        if (getValue(this.style, constants.STYLE_HORIZONTAL, 1) !== 1) {
            //rot += mxText.prototype.verticalTextRotation;
            rot += -90;
        }

        return rot;
    },

    getShapeRotation: function () {
        var rot = this.getRotation();

        if (this.direction) {
            if (this.direction === constants.DIRECTION_NORTH) {
                rot += 270;
            }
            else if (this.direction === constants.DIRECTION_WEST) {
                rot += 180;
            }
            else if (this.direction === constants.DIRECTION_SOUTH) {
                rot += 90;
            }
        }

        return rot;
    },

    createTransparentSvgRectangle: function (x, y, w, h) {
        var rect = document.createElementNS(constants.NS_SVG, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', 'none');
        rect.setAttribute('pointer-events', 'all');

        return rect;
    },

    setTransparentBackgroundImage: function (node) {
        node.style.backgroundImage = 'url(\'' + mxClient.imageBasePath + '/transparent.gif\')';
    },

    releaseSvgGradients: function (grads) {
        if (grads != null) {
            for (var key in grads) {
                var gradient = grads[key];
                gradient.mxRefCount = (gradient.mxRefCount || 0) - 1;

                if (gradient.mxRefCount == 0 && gradient.parentNode != null) {
                    gradient.parentNode.removeChild(gradient);
                }
            }
        }
    },

    isPaintBoundsInverted: function () {
        return !this.stencil && (this.direction === constants.DIRECTION_NORTH ||
            this.direction === constants.DIRECTION_SOUTH);
    },

    destroy: function () {
        if (this.node) {
            mxEvent.release(this.node);

            if (this.node.parentNode) {
                this.node.parentNode.removeChild(this.node);
            }

            this.node = null;
        }

        // Decrements refCount and removes unused
        this.releaseSvgGradients(this.oldGradients);
        this.oldGradients = null;
    }

});

export default Shape;
