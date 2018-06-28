(function($){

    $.widget('mapbender.mbSearchRouter', {
        options: {
            asDialog: true,     // Display as jQuery UI dialog
            timeoutFactor: 2    // use delay * timeoutFactor before showing
        },
        callbackUrl: null,
        selected: null,
        highlightLayer: null,
        lastSearch: new Date(),
        resultCallbackEvent: null,
        resultCallbackProxy: null,
        searchModel: null,
        autocompleteModel: null,
        popup: null,
        map: null,
        model: null,
        highlightLayerOwner: 'Search Highlight',
        highlightLayerId: null,
        defaultStyle: {
            fill : {
                color : 'rgba(255,0,0,0.3)'
            },
            stroke: {
                color: 'rgba(255,0,0,1)',
                width: 2
            },
            circle: {
                radius: 5,
                color: 'rgba(255,0,0,0.3)',
                stroke: {
                    color: 'rgba(255,0,0,1)',
                    width: 2
                }
            },
            text: {
                font: '13px Calibri,sans-serif',
                fill: {
                    color: 'rgba(255,0,0,1)'
                },
                stroke: {
                    color: 'rgba(255,255,255,1)',
                    width: 1
                },
                offsetY: -15

            }
        },
        selectStyle: {
            fill : {
                color : 'rgba(255,170,0,0.3)'
            },
            stroke: {
                color: 'rgba(255,170,0,1)',
                width: 2
            },
            circle: {
                radius: 5,
                color: 'rgba(255,170,0,0.3)',
                stroke: {
                    color: 'rgba(255,170,0,1)',
                    width: 2
                }
            },
            text: {
                font: '12px Calibri,sans-serif',
                fill: {
                    color: 'rgba(255,170,0,1)'
                },
                stroke: {
                    color: 'rgba(255,255,255,1)',
                    width: 2
                },
                offsetY: -15
            }
        },
        temporaryStyle: {
            fill : {
                color : 'rgba(255,170,0,0.3)'
            },
            stroke: {
                color: 'rgba(255,170,0,1)',
                width: 2
            },
            circle: {
                radius: 5,
                color: 'rgba(255,170,0,0.3)',
                stroke: {
                    color: 'rgba(255,170,0,1)',
                    width: 2
                }
            }
        },
        /**
         * Ready event listeners
         *
         * @var {Array<Function>}
         */
        readyCallbacks: [],

        /**
         * Widget creator
         */
        _create: function(){
            var widget = this;
            var options = widget.options;

            if(!Mapbender.checkTarget("mbSearchRouter", options.target)){
                return;
            }
            Mapbender.elementRegistry.onElementReady(options.target, $.proxy(widget._setup, widget));
            widget.callbackUrl = Mapbender.configuration.application.urls.element + '/' + widget.element.attr('id') + '/';
        },

        /**
         * Remove last search results
         */
        removeLastResults: function(){
            var widget = this;
            var map = widget.map;
            widget.searchModel.reset();
            widget._getLayer();
            widget.map.model.removeVectorLayer(widget.highlightLayerOwner, widget.highlightLayerId);
        },

        _setup:         function(){
            var widget = this;
            var element = widget.element;
            var options = widget.options;
            var searchModel = widget.searchModel = new Mapbender.SearchModel(null, null, widget);
            var routeSelect = $('select#search_routes_route', element);
            var routeCount = 0;
            this.map = Mapbender.elementRegistry.listWidgets().mapbenderMbMap;
            this.model = this.map.model;
            var map = this.map;

            // bind form reset to reset search model
            element.delegate('.search-forms form', 'reset', function(){
                widget.removeLastResults();
            });
            // bind form submit to send search model
            element.delegate('.search-forms form', 'submit', function(evt){
                widget.removeLastResults();
                widget.searchModel.submit(evt);
            });

            // bind result to result list and map view
            searchModel.on('change:results', widget._searchResults, widget);
            searchModel.on('request', widget._setActive, widget);
            searchModel.on('error sync', widget._setInactive, widget);
            searchModel.on('error sync', widget._showResultState, widget);

            widget.resultCallbackProxy = $.proxy(widget._resultCallback, widget);

            // Prepare autocompletes
            $('form input[data-autocomplete="on"]', element).each(
                $.proxy(widget._setupAutocomplete, widget));
            $('form input[data-autocomplete^="custom:"]', element).each(
                $.proxy(widget._setupCustomAutocomplete, widget));

            // Prepare search button (trigger form submit)
            $('a[role="search_router_search"]', element)
                .button()
                .click(function(){
                    widget.getCurrentForm().submit();
                });

            // Prevent map getting cursors keys
            element.bind('keydown', function(event){
                event.stopPropagation();
            });

            // Listen to changes of search select (switching and forms resetting)

            routeSelect.change($.proxy(widget._selectSearch, widget));
            Mapbender.elementRegistry.onElementReady(options.target, function(){
                routeSelect.change();
                widget._trigger('ready');
            });
            // But if there's only one search, we actually don't need the select
            for(var route in options.routes){
                if(options.routes.hasOwnProperty(route)){
                    routeCount++;
                }
            }
            if(routeCount === 1){
                $('#search_routes_route_control_group').hide()
                    .next('hr').hide();
            }

            if(!options.asDialog) {
                element.on('click', '.search-action-buttons a', function(event) {
                    event.preventDefault();
                    var target = $(event.target).attr('href');
                    var targetBase = '#' + widget.element.attr('id') + '/button/';
                    switch(target) {
                        case (targetBase + 'reset'):
                            widget._reset();
                            break;
                        case (targetBase + 'ok'):
                            widget._search();
                            break;
                    }
                });
            }

            map.model.setOnMoveendHandler(widget.redraw());

            widget._trigger('ready');
            widget._ready();

            if(widget.options.autoOpen) {
                widget.open();
            }
        },

        /** TODO Change drawFeature Function
         * Redraw current result layer selected feature
         */
        redraw: function() {
            var widget = this;
            var feature = widget.currentFeature ? widget.currentFeature : null;
            if( widget.currentFeature) {
                //feature.layer.drawFeature(feature, 'select');
                feature.setStyle(this.styleMap['select'])
            }
        },

        defaultAction: function(callback){
            this.open(callback);
        },

        /**
         * Open method stub. Calls dialog's open method if widget is configured as
         * an dialog (asDialog: true), otherwise just goes on and does nothing.
         */
        open: function(callback){
            this.callback = callback ? callback : null;
            if(true === this.options.asDialog) {
                if(!this.popup || !this.popup.$element){
                    this.popup = new Mapbender.Popup2({
                        title: this.element.attr('title'),
                        draggable: true,
                        modal: false,
                        closeButton: true,
                        closeOnESC: false,
                        content: this.element,
                        width: this.options.width ? this.options.width : 450,
                        resizable: true,
                        height: this.options.height ? this.options.height : 500,
                        buttons: {
                            'cancel': {
                                label: Mapbender.trans('mb.core.searchrouter.popup.btn.cancel'),
                                cssClass: 'button buttonCancel critical right',
                                callback: $.proxy(this.close, this)
                            },
                            'reset': {
                                label: Mapbender.trans('mb.core.searchrouter.popup.btn.reset'),
                                cssClass: 'button right',
                                callback: $.proxy(this._reset, this)
                            },
                            'ok': {
                                label: Mapbender.trans("mb.core.searchrouter.popup.btn.ok"),
                                cssClass: 'button right',
                                callback: $.proxy(this._search, this)
                            }
                        }
                    });
                    this.popup.$element.on('close', $.proxy(this.close, this));
                }else{

                }
                this.element.show();
            }
        },

        /**
         * Close method stub. Calls dialog's close method if widget is configured
         * as an dialog (asDialog: true), otherwise just goes on and does nothing.
         */
        close: function(){
            if(true === this.options.asDialog){
                if(this.popup){
                    if(this.popup.$element){
                        this.element.hide().appendTo($('body'));
                        this.popup.destroy();
                    }
                    this.popup = null;
                }
            }
            this.callback ? this.callback.call() : this.callback = null;
        },

        /**
         * Set up result table when a search was selected.
         *
         * @param  jqEvent event Change event
         */
        _selectSearch: function(event){
            var selected = this.selected = $(event.target).val();

            $('form', this.element).each(function(){
                var form = $(this);
                if(form.attr('name') === selected) {
                    form.show();
                }else{
                    form.hide();
                }
                form.get(0).reset();
            });

            $('.search-results', this.element).empty();
        },

        /**
         * Reset current search form
         */
        _reset: function() {
            $('select#search_routes_route', this.element).change();
            this.currentFeature = null;
        },

        /**
         * Set up autocomplete widgets for all inputs with data-autcomplete="on"
         *
         * @param  integer      idx   Running index
         * @param  HTMLDomNode  input Input element
         */
        _setupAutocomplete: function(idx, input){
            var widget = this;
            input = $(input);
            var ac = input.autocomplete({
                delay: input.data('autocomplete-delay') || 500,
                minLength: input.data('autocomplete-minlength') || 3,
                search: $.proxy(widget._autocompleteSearch, widget),
                open: function( event, ui, t) {
                    $(event.target).data("uiAutocomplete").menu.element.outerWidth(input.outerWidth());
                },
                source: function(request, response){
                    widget._autocompleteSource(input, request, response);
                },
                select: widget._autocompleteSelect
            }).keydown(widget._autocompleteKeydown);
        },

        /**
         * Set up autocpmplete provided by custom widget (data-autcomplete="custom:<widget>")
         *
         * @param  integer      idx   Running index
         * @param  HTMLDomNode  input Input element
         */
        _setupCustomAutocomplete: function(idx, input){
            var plugin = $(input).data('autocomplete').substr(7);
            $(input)[plugin]();
        },

        /**
         * Autocomplete source handler, does all Ajax magic.
         *
         * @param  HTMLDomNode target   Input element
         * @param  Object      request  Request object with term attribute
         * @param  function    response Autocomplete callback
         */
        _autocompleteSource: function(target, request, response){
            if(!target.data('autocompleteModel')){
                var model = new Mapbender.AutocompleteModel(null, {
                    router: this
                });
                target.data('autocompleteModel', model);

                model.on('request', this._setActive, this);
                model.on('sync', function(){
                    model.response(model.get('results'));
                });
                model.on('error', response([]));
            }

            target.data('autocompleteModel').response = response;
            target.data('autocompleteModel').submit(target, request);
        },

        /**
         * Store autocomplete key if suggestion was selected.
         *
         * @param  jQuery.Event event Selection event
         * @param  Object       ul    Selected item
         */
        _autocompleteSelect: function(event, ui){
            if(typeof ui.item.key !== 'undefined'){
                $(event.target).attr('data-autocomplete-key', ui.item.key);
            }
        },

        /**
         * Remove stored autocomplete key when key was pressed.
         *
         * @param  jQuery.Event event Keydown event
         */
        _autocompleteKeydown: function(event){
            $(event.target).removeAttr('data-autocomplete-key');
        },

        /**
         * Autocomplete search handler.
         *
         * Checks if enough time has been passed since the last search. Basically
         * this prevents an autocomplete poping up when a search is triggered by
         * keyboard.
         *
         * @param  jQuery.Event event search event
         * @param  Object       ui    n/a
         */
        _autocompleteSearch: function(event, ui,t){
            var input = $(event.target);
            var autoCompleteMenu = $(input.data("uiAutocomplete").menu.element);
            var delay = input.autocomplete('option', 'delay'),
                diff = (new Date()) - this.lastSearch;

            autoCompleteMenu.addClass("search-router");
            console.log(autoCompleteMenu.attr("class"));

            if(diff <= delay * this.options.timeoutFactor){
                event.preventDefault();
            }
        },

        /**
         * Start a search, but only after successful form validation
         */
        _search: function() {
            var form = $('form[name="' + this.selected + '"]', this.element);
            var valid = true;
            $.each($(':input[required]', form), function() {
                if('' === $(this).val()) {
                    valid = false;
                }
            });

            if(valid) {
                form.submit();
            }
        },

        /**
         * Prepare search result table
         */
        _prepareResultTable: function(container){
            if(typeof this.options.routes[this.selected].results.headers === 'undefined'){
                return;
            }

            var headers = this.options.routes[this.selected].results.headers;

            var table = $('<table></table>'),
                thead = $('<thead><tr></tr></thead>').appendTo(table);

            for(var header in headers){
                thead.append($('<th>' + headers[header] + '</th>'));
            }

            table.append($('<tbody></tbody>'));

            container.append(table);

            this._setupResultCallback();
        },

        /**
         * Update result list when search model's results property was changed
         */
        _searchResults: function(model, results, options){
            if('table' === this.options.routes[this.selected].results.view) {
                var container = $('.search-results', this.element);
                if($('table', container).length === 0) {
                    this._prepareResultTable(container);
                }
                this._searchResultsTable(model, results, options);
            }
        },

        /**
         * Rebuilds result table with search result data.
         *
         * @param {SearchModel} model
         * @param {FeatureCollection} results
         * @param {Object} options Backbone options (not used?)
         */
        _searchResultsTable: function(model, results, options){
            var headers = this.options.routes[this.selected].results.headers;
            var table = $('.search-results table', this.element);
            var tbody = $('<tbody></tbody>');
            var layer = this._getLayer(true);
            var self = this;

            $('tbody', table).remove();

            // Check Features of layer
            if (layer.getSource().getFeatures()){
                layer.getSource().clear();
            }
            var features = [];

            if(results.length > 0) $('.no-results', this.element).hide();

            results.each(function(feature, idx) {
                var row = $('<tr/>');
                row.addClass(idx % 2 ? "even" : "odd");
                row.data('feature', feature);

                for (var header in headers) {
                    var d = feature.get('properties')[header];
                    row.append($('<td>' + (d || '') + '</td>'));
                }

                tbody.append(row);
                var feature = feature.getFeature();
                features.push(feature);
            });

            table.append(tbody);

            var layerSource = layer.getSource();
            layerSource.addFeatures(features);

            self.map.model.map.addLayer(layer);

            $('.search-results tbody tr')
                .on('click', function () {
                    var feature = $(this).data('feature').getFeature();
                    self._highlightFeature(feature,self.styleMap['select']);
                })
                .on('mouseenter', function () {
                    var feature = $(this).data('feature').getFeature();

                    if(feature.renderIntent !== 'select') {
                        self._highlightFeature(feature,self.styleMap['temporary']);
                    }
                })
                .on('mouseleave', function () {
                    var feature = $(this).data('feature').getFeature();

                    if(feature.renderIntent !== 'select') {
                        self._highlightFeature(feature,self.styleMap['default']);
                    }
                })
            ;
        },

        _highlightFeature: function (feature, style) {
            feature.setStyle(style);
        },

        _showResultState: function() {
            var widget = this;
            var element = widget.element;
            var table = $('.search-results table', element);
            var counter = $('.result-counter', element);

            if(0 === counter.length) {
                counter = $('<div/>', {'class': 'result-counter'})
                  .prependTo($('.search-results', element));
            }

            var results = widget.searchModel.get('results');

            if(results.length > 0) {
                counter.text(Mapbender.trans('mb.core.searchrouter.result_counter', {
                    count: results.length
                }));
                table.show();
            } else {
                table.hide();
                counter.text(Mapbender.trans('mb.core.searchrouter.no_results'));
            }
        },

        /**
         * Add active class to widget for styling when Ajax is running
         */
        _setActive: function(){
            var outer = this.options.asDialog ? this.element.parent() : this.element;
            outer.addClass('search-active');
        },

        /**
         * Remove active class from widget
         */
        _setInactive: function(){
            var outer = this.options.asDialog ? this.element.parent() : this.element;
            outer.removeClass('search-active');
        },

        _createStyleMap: function(styles) {
            var map = this.map;
            var styleMap = {};
            var styleDefault = null;
            var styleSelect = null;
            var keys = styles ? Object.keys(styles): null;

            if (keys){
                for (var i = 0; i < keys.length; i++) {
                    var styleMapName = keys[i];

                    switch(styleMapName) {
                        case 'default':
                            styleDefault = styleMapName ? map.model.createVectorLayerStyle(styleMapName) : map.model.createVectorLayerStyle();
                            break;
                        case 'select':
                            styleSelect = styleMapName ? map.model.createVectorLayerStyle(styleMapName) : map.model.createVectorLayerStyle();
                            break;
                    }

                }
            }else{
                styleDefault = map.model.createVectorLayerStyle(this.defaultStyle);
                styleSelect = map.model.createVectorLayerStyle(this.selectStyle);
            }

            styleMap = {
                default: styleDefault,
                select: styleSelect,
                temporary: map.model.createVectorLayerStyle(this.temporaryStyle)
            };

            return styleMap;
        },

        /**
         * Get current route configuration
         *
         * @returns object route configuration
         */
        getCurrentRoute: function() {
            var widget = this;
            var options = widget.options;
            return options.routes[widget.selected];
        },

        /**
         * Get highlight layer. Will construct one if neccessary.
         * @TODO: Backbonify (view)
         *
         * @return OpenLayers.Layer.Vector Highlight layer
         */
        _getLayer: function(forceRebuild) {
            var widget = this;
            var options = widget.options;
            var map = widget.map;
            var layer = widget.highlightLayer;
            var layerOwner = widget.highlightLayerOwner;
            var layerId = widget.highlightLayerId;

            if(!forceRebuild && ( layer && layerId ) ) {
                layer = map.model.getVectorLayerByNameId(layerOwner,layerId);
                return layer;
            }

            if(forceRebuild && ( layer && layerId ) ) {
                map.removeVectorLayer(layer,layerId);
                widget.highlightLayer = null;
                widget.highlightLayerId = null;
            }

            var route = widget.getCurrentRoute();

            var center = map.model.getMapCenter();
            var iconFeature = new ol.Feature(
                new ol.geom.Point(center)
            );
            var markersSource = new ol.source.Vector({
                features: [iconFeature]
            });

            var styleMap = widget._createStyleMap(route.results.styleMap);
            this.styleMap = styleMap;

            layerId = widget.highlightLayer || map.model.createVectorLayer({
                style: styleMap.default
            }, layerOwner);

            widget.highlightLayerId = layerId;
            layer = map.model.getVectorLayerByNameId(layerOwner,layerId);
            layer.setSource(markersSource);
            layer.setStyle(this.styleMap['default']);

            return layer;
        },

        /**
         * Set up result callback (zoom on click for example)
         */
        _setupResultCallback: function(){
            var widget = this;
            var anchor = $('.search-results', widget.element);
            if(widget.resultCallbackEvent !== null){
                anchor.undelegate('tbody tr', widget.resultCallbackEvent,
                    widget.resultCallbackProxy);
                widget.resultCallbackEvent = null;
            }

            var event = widget.options.routes[widget.selected].results.callback.event;
            if(typeof event === 'string'){
                anchor.delegate('tbody tr', event, widget.resultCallbackProxy);
                widget.resultCallbackEvent = event;
            }
        },

        /**
         * Result callback
         *
         * @param  jQuery.Event event Mouse event
         */
        _resultCallback: function(event){
            var widget = this;
            var options = widget.options;
            var row = $(event.currentTarget);
            var feature = $.extend({}, row.data('feature').getFeature());
            var map = widget.map;
            var model = map.model;
            var callbackConf = widget.getCurrentRoute().results.callback;
            var srs = widget.searchModel.get("srs");
            var mapProj = model.getCurrentProjectionCode();

            if(srs.projCode !== mapProj.projCode) {
                featureGeometry = feature.getGeometry();
                transFeatureGeomtry = featureGeometry.transform(srs, mapProj);
                feature.setGeometry(transFeatureGeomtry);
            }

            var featureExtent = feature.getGeometry().getExtent();

            // buffer, if needed
            if(callbackConf.options && callbackConf.options.buffer){
                var radius = callbackConf.options.buffer;
                featureExtent[0] -= radius;
                featureExtent[1] -= radius;
                featureExtent[2] += radius;
                featureExtent[3] += radius;
            }

            // get zoom for buffered extent
            var mapSize = model.map.getSize();
            var extent = model.getMapExtent();
            var res = model.getResolutionForExtent(extent, mapSize);
            var zoom = model.getZoomForResolution(res);

            // restrict zoom if needed
            if(callbackConf.options &&
               (callbackConf.options.maxScale || callbackConf.options.minScale)){

                var unit = model.getUnitsOfCurrentProjection();

                if(callbackConf.options.maxScale){
                    var maxRes = model.getResolutionForScale(callbackConf.options.maxScale,unit);
                    if(Math.round(res) < maxRes){
                        zoom = map.getZoomForResolution(maxRes);
                    }
                }

                if(callbackConf.options.minScale){
                    var minRes = model.getResolutionForScale(callbackConf.options.minScale,unit);
                    if(Math.round(res) > minRes){
                        zoom = map.getZoomForResolution(minRes);
                    }
                }
            }

            // finally fit to View with zoom and duration of Animation
            map.model.panToExtent(featureExtent, {duration: 500, maxZoom: zoom});

            // And highlight new feature
            // TODO  Feature wird nicht gezeichnet. bsp: https://gis.stackexchange.com/questions/166506/openlayers-3-select-interaction-style-function
            var layer = feature;


            if (feature) {
                //feature.forEach(function(feature){
                    console.info(feature);
                    feature.setStyle(this.styleMap['selectStyle']);
                //});
            } else {
                //feature.forEach(function(feature){
                    console.info(feature);
                    feature.setStyle(this.styleMap['default']);
                //});
            }

            //$.each(layer, function(idx, feature) {
            //    console.log(feature);
            //    feature.setStyle();
            //});

            //widget.currentFeature = feature;
            //widget.refresh();
            //layer.selectedFeatures.push(feature);
        },

        ready: function(callback) {
            var widget = this;
            if(widget.readyState === true){
                callback();
            }else{
                widget.readyCallbacks.push(callback);
            }
        },

        /**
         * Execute callbacks on element ready
         */
        _ready: function() {
            var widget = this;
                for (var callback in widget.readyCallbacks) {
                    if(widget.readyCallbacks.hasOwnProperty(callback)) {
                        callback();
                        delete(widget.readyCallbacks[callback]);
                    }
            }
            widget.readyState = true;
        },

        /**
         * Get current form
         *
         * @returns {*|HTMLElement}
         */
        getCurrentForm: function() {
            var widget = this;
            return $('form[name="' + widget.selected + '"]', widget.element);
        }
    });
})(jQuery);
