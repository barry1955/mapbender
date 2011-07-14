(function($) {

$.widget("mapbender.mbButton", {
	options: {
        target: undefined,
        click: undefined,
        icon: undefined,
        label: true,
        group: undefined
    },

	_create: function() {
		var self = this;
		var me = $(this.element);

        var o = {};
        if(this.options.icon) {
            $.extend(o, {
                icons: {
                    primary: this.options.icon,
                },
                text: this.options.label
            });
        }

        // Radios are inside a div, so we need to button'ize the right element
        var b = this.options.group ? me.find('input') : me;
        b.button(o);
        var c = this.options.group ? me.find('label') : me;
        c.bind('click', $.proxy(self._onClick, self));
        me.bind('mbButtonDeactivate', $.proxy(self.deactivate, self));
	},

	_setOption: function(key, value) {
	},

    _onClick: function() {
        // If we're part of a group, deactivate all other actions in this group
        if(this.options.group) {
            var me = $(this.element);
            var others = $('input[type="radio"][name="' + this.options.group + '"]')
                .parent()
                .not(me);
            others.trigger('mbButtonDeactivate');
        }
        this.activate();
        return false;
    },

    activate: function() {
        if(this.options.target && this.options.action) {
            var target = $('#' + this.options.target);
            var widget = Mapbender.configuration.elements[this.options.target].init;
            target[widget](this.options.action);
        }
    },

    deactivate: function() {
    }
});

})(jQuery);

