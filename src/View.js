import {
    each,
    isUndefined,
    isNullOrUndefined,
    getCurrentStyle,
    createSvgElement
} from './common/utils';

import detector    from './common/detector';
import Base        from './lib/Base';
import Point       from './lib/Point';
import Rectangle   from './lib/Rectangle';
import Dictionary  from './lib/Dictionary';
import ChildChange from './changes/ChildChange';

export default Base.extend({

    constructor: function View(graph) {

        var that = this;
        that.graph = graph;
        that.states = new Dictionary();
        that.translate = new Point();
        that.graphBounds = new Rectangle();
    },

    getBounds: function () {},

    setCurrentRoot: function () {},

    scaleAndTranslate: function () {},

    setScale: function () {},

    setTranslate: function () {},

    refresh: function () {},

    revalidate: function () {
        return this
            .invalidate()
            .validate();
    },

    clear: function () {},

    invalidate: function (cell, recurse, includeLink) {

        var that = this;
        var model = that.graph.model;

        cell = cell || model.getRoot();
        recurse = !isUndefined(recurse) ? recurse : true;
        includeLink = !isUndefined(includeLink) ? includeLink : true;


        var state = that.getState(cell);

        if (state) {
            state.invalid = true;
        }

        // 只有 node 才有递归的必要
        if (!cell.invalidating && cell.isNode) {

            cell.invalidating = true;

            if (recurse) {
                cell.eachChild(function (child) {
                    that.invalidate(child, recurse, includeLink);
                });
            }

            if (includeLink) {
                cell.eachLink(function (link) {
                    that.invalidate(link, recurse, includeLink);
                });
            }

            delete cell.invalidating;
        }

        return that;
    },

    validate: function () {

    },

    getEmptyBounds: function () {},

    getBoundingBox: function () {},

    validateCell: function () {},

    validateCellState: function () {},

    updateCellState: function () {},

    updateVertexState: function () {},

    updateEdgeState: function () {},

    updateVertexLabelOffset: function () {},

    resetValidationState: function () {
        this.lastNode = null;
        this.lastHtmlNode = null;
        this.lastForegroundNode = null;
        this.lastForegroundHtmlNode = null;
    },

    stateValidated: function (state) {},

    updateFixedTerminalPoints: function () {},
    updateFixedTerminalPoint: function () {},

    updatePoints: function (edge, points, source, target) {},

    transformControlPoint: function (state, pt) {},

    getEdgeStyle: function (edge, points, source, target) {},

    updateFloatingTerminalPoints: function (state, source, target) {},

    updateFloatingTerminalPoint: function (edge, start, end, source) {},

    getTerminalPort: function (state, terminal, source) {},

    getPerimeterPoint: function (terminal, next, orthogonal, border) {},

    getRoutingCenterX: function (state) {},

    getRoutingCenterY: function (state) {},

    getPerimeterBounds: function (terminal, border) {},

    getPerimeterFunction: function (state) {},

    getNextPoint: function (edge, opposite, source) {},

    getVisibleTerminal: function (edge, source) {},

    updateEdgeBounds: function (state) {},

    getPoint: function (state, geometry) {},

    getRelativePoint: function (edgeState, x, y) {},

    updateEdgeLabelOffset: function (state) {},

    // State
    // -----
    getState: function (cell, create) {

        if (!cell) {
            return;
        }

        var that = this;
        var states = that.states;
        var state = states.get(cell);

        // TODO: that.updateStyle
        if (create && (!state || that.updateStyle) && cell.visible) {

            if (!state) {
                state = that.createState(cell);
                states.put(cell, state);
            } else {
                state.style = that.graph.getCellStyle(cell);
            }
        }

        return state;
    },

    createState: function (cell) {

        var that = this;
        var graph = that.graph;

        // TODO: that.currentRoot

        var state = new CellState(this, cell, this.graph.getCellStyle(cell));

        if (graph.container && cell !== that.currentRoot && (cell.isNode || cell.isLink)) {
            this.graph.cellRenderer.createShape(state);
        }

        return state;
    },

    removeState: function (cell) {

        var that = this;
        var state = null;

        if (cell) {
            state = that.states.remove(cell);

            if (state) {
                that.graph.cellRenderer.destroy(state);
                state.destroy();
            }
        }

        return state;
    },


    isContainerEvent: function (evt) {},

    isScrollEvent: function (evt) {},

    init: function () {

        var that = this;
        var root = createSvgElement('svg');
        var canvas = createSvgElement('g');
        var backgroundPane = createSvgElement('g');
        var drawPane = createSvgElement('g');
        var overlayPane = createSvgElement('g');
        var decoratorPane = createSvgElement('g');

        canvas.appendChild(backgroundPane);
        canvas.appendChild(drawPane);
        canvas.appendChild(overlayPane);
        canvas.appendChild(decoratorPane);
        root.appendChild(canvas);

        root.style.width = '100%';
        root.style.height = '100%';
        root.style.display = 'block';

        that.canvas = canvas;
        that.backgroundPane = backgroundPane;
        that.drawPane = drawPane;
        that.overlayPane = overlayPane;
        that.decoratorPane = decoratorPane;

        var container = that.graph.container;
        if (container) {
            container.appendChild(root);

            // update container style
            var style = getCurrentStyle(container);
            if (style.position === 'static') {
                container.style.position = 'relative';
            }

            // Disables built-in pan and zoom in IE10 and later
            if (detector.IS_POINTER) {
                container.style.msTouchAction = 'none';
            }
        }

        that.installListeners();
    },

    installListeners: function () { },

    destroy: function () { }
});
