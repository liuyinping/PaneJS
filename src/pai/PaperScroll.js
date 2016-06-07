import      * as utils from '../common/utils';
import          vector from '../common/vector';
import        detector from '../common/detector';
import           Point from '../geometry/Point';


const defaults = {
    paper: null,
    padding: 0,
    minWidth: 0,
    minHeight: 0
};

class PaperScroll {

    constructor(options) {

        if (options) {
            this.install(options);
        }
    }

    install(options) {

        this.options = utils.merge({}, defaults, options);
        this.paper   = this.options.paper;

        let paper = this.paper;

        // keep scale values for a quicker access
        let scale = vector(paper.viewport).scale();

        this.sx = scale.sx;
        this.sy = scale.sy;

        // keep the original paper size
        this.baseWidth   = paper.options.width;
        this.baseHeight  = paper.options.height;
        this.basePadding = utils.normalizeSides(this.options.padding);

        this.ensureElement();
        this.adjustPadding();

        paper.on('paper:scale', this.onScale, this);
        paper.on('paper:resize', this.onResize, this);
    }

    ensureElement() {

        let paper = this.paper;
        let elem  = this.elem = utils.createElement('div');

        utils.addClass(elem, 'pane-scroll');

        elem.appendChild(paper.root);
        paper.container.appendChild(elem);

        return this;
    }

    adjustPadding(padding = {}) {

        padding = utils.normalizeSides(padding);

        let basePadding = this.basePadding;
        let paddingTop  = Math.round(basePadding.top + padding.top);
        let paddingLeft = Math.round(basePadding.left + padding.left);

        // Make sure that at least a fragment of the
        // paper is always visible on the screen.
        paddingTop  = Math.min(paddingTop, this.elem.clientHeight * 0.9);
        paddingLeft = Math.min(paddingLeft, this.elem.clientWidth * 0.9);

        utils.setStyle(this.elem, {
            paddingLeft: paddingLeft + 'px',
            paddingTop: paddingTop + 'px'
        });

        // It is impossible to apply bottom and right padding on `this.elem`
        // as it would have no effect while overflow in FF and IE.
        // see 'https://bugzilla.mozilla.org/show_bug.cgi?id=748518'
        utils.setStyle(this.paper.root, {
            marginRight: Math.round(basePadding.right + padding.right) + 'px',
            marginBottom: Math.round(basePadding.bottom + padding.bottom) + 'px'
        });

        this.padding = {
            paddingTop,
            paddingLeft
        }

        return this;
    }

    adjustPaper() {

        // store the current mid point of visible paper area, so we can
        // center the paper to the same point after the resize.
        this.centerPoint = this.getCenter();

        let sx = this.sx;
        let sy = this.sy;

        let options = {
            frameWidth: this.baseWidth * sx,
            frameHeight: this.baseHeight * sy,
            allowNewOrigin: 'negative'
        };

        if (this.options.minWidth) {
            options.minWidth = this.options.minWidth * sx;
        }

        if (this.options.minHeight) {
            options.minHeight = this.options.minHeight * sy;
        }

        this.paper.fitToContent(options);

        return this;
    }

    onScale(sx, sy, ox, oy) {

        this.sx = sx;
        this.sy = sy;

        this.adjustPaper();

        if (ox || oy) {
            this.center(ox, oy);
        }

        return this;
    }

    onResize() {

        if (this.centerPoint) {
            this.center(this.centerPoint.x, this.centerPoint.y);
        }

        return this;
    }

    toLocalPoint(x, y) {

        var ctm = this.paper.viewport.getCTM();

        x += this.elem.scrollLeft - this.padding.paddingLeft - ctm.e;
        x /= ctm.a;

        y += this.elem.scrollTop - this.padding.paddingTop - ctm.f;
        y /= ctm.d;

        return new Point(x, y);
    }

    center(x, y) {

        // Adjust the paper position so the point [x,y] is moved to the
        // center of scroll element. If no point given [x,y] equals
        // to center of the paper element.

        let paper  = this.paper;
        let matrix = paper.viewport.getCTM();

        // the paper rectangle
        //   x1,y1 ---------
        //   |             |
        //   ----------- x2,y2
        var x1 = -matrix.e; // translate x
        var y1 = -matrix.f; // translate y
        var x2 = x1 + paper.options.width;
        var y2 = y1 + paper.options.height;

        if (utils.isUndefined(x) || utils.isUndefined(y)) {
            // find center of the paper rect
            x = (x1 + x2) / 2;
            y = (y1 + y2) / 2;
        } else {
            // local coordinates to viewport coordinates
            x *= matrix.a; // scale x
            y *= matrix.d; // scale y
        }


        var padding = this.basePadding;
        var centerX = this.elem.clientWidth / 2;
        var centerY = this.elem.clientHeight / 2;

        // calculate padding
        var left   = centerX - padding.left - x + x1;
        var right  = centerX - padding.right + x - x2;
        var top    = centerY - padding.top - y + y1;
        var bottom = centerY - padding.bottom + y - y2;

        this.adjustPadding({
            top: Math.max(top, 0),
            right: Math.max(right, 0),
            bottom: Math.max(bottom, 0),
            left: Math.max(left, 0)
        });

        this.elem.scrollTop  = y - centerY + matrix.f + this.padding.paddingTop;
        this.elem.scrollLeft = x - centerX + matrix.e + this.padding.paddingLeft;

        return this;
    }

    getCenter() {

        return this.toLocalPoint(this.elem.clientWidth / 2, this.elem.clientHeight / 2);
    }

    beforeZoom() {

        if (detector.IS_IE) {
            // IE is trying to show every frame while we manipulate the paper.
            // That makes the viewport kind of jumping while zooming.
            utils.setStyle(this.elem, 'visibility', 'hidden');
        }

        return this;
    }

    afterZoom() {

        if (detector.IS_IE) {
            utils.setStyle(this.elem, 'visibility', '');
        }

        return this;
    }

    zoom(value, options = {}) {

        var sx = value;
        var sy = value;

        if (!options.absolute) {
            sx += this.sx;
            sy += this.sy;
        }

        let scaleGrid = options.scaleGrid;
        if (scaleGrid) {
            sx = utils.snapToGrid(sx, scaleGrid);
            sy = utils.snapToGrid(sy, scaleGrid);
        }

        // check if the new scale won't exceed the given boundaries
        let minScale = options.minScale;
        let maxScale = options.maxScale;

        sx = utils.clamp(sx, minScale || 0, maxScale || Number.MAX_VALUE);
        sy = utils.clamp(sy, minScale || 0, maxScale || Number.MAX_VALUE);


        var center = this.getCenter();
        var ox     = options.ox;
        var oy     = options.oy;

        // if the origin is not specified find the center
        // of the paper's visible area.
        if (utils.isUndefined(ox) || utils.isUndefined(oy)) {

            ox = center.x;
            oy = center.y;

        } else {

            var fsx = sx / this.sx;
            var fsy = sy / this.sy;

            ox = ox - ((ox - center.x) / fsx);
            oy = oy - ((oy - center.y) / fsy);
        }

        this.beforeZoom();

        this.paper.scale(sx, sy);
        this.center(ox, oy);

        this.afterZoom();

        return this;
    }

    zoomToFit(options = {}) {

        var paper = this.paper;

        var x = paper.options.x;
        var y = paper.options.y;

        options.fittingBBox = options.fittingBBox || paper.getContentBBox();

        console.log(options.fittingBBox);

        this.beforeZoom();

        // scale the viewport
        paper.scaleContentToFit(options);
        // restore original origin
        paper.translate(x, y);

        this.adjustPaper();
        this.centerContent();

        this.afterZoom();

        return this;
    }

    centerContent() {

        let bbox = this.paper.getContentBBox(true);
        this.center(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);

        return this;
    }
}


export default PaperScroll;