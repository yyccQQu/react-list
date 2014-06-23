(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['react'], factory);
  } else if (typeof exports !== 'undefined') {
    module.exports = factory(require('react'));
  } else {
    root.ReactList = factory(root.React);
  }
})(this, function (React) {
  'use strict';

  var DOM = React.DOM;

  var requestAnimationFrame =
    (typeof window !== 'undefined' && window.requestAnimationFrame) ||
      function (cb) { setTimeout(cb, 16); }
  var cancelAnimationFrame =
    (typeof window !== 'undefined' && window.cancelAnimationFrame) ||
      function (id) { clearTimeout(id); }

  var isEqualSubset = function (a, b) {
    for (var key in a) if (b[key] !== a[key]) return false;
    return true;
  };

  var isEqual = function (a, b) {
    return isEqualSubset(a, b) && isEqualSubset(b, a);
  };

  return React.createClass({
    getDefaultProps: function () {
      return {
        items: [],
        isLoading: false,
        error: null,
        renderPageSize: 10,
        threshold: 500,
        uniform: false,
        component: DOM.div,
        renderItem: function (item, i) { return DOM.div({key: i}, item); },
        renderLoading: function () { return DOM.div(null, 'Loading...'); },
        renderError: function (er) { return DOM.div(null, er); },
        renderEmpty: function () { return DOM.div(null, 'Nothing to show.'); }
      };
    },

    getInitialState: function () {
      return {
        isLoading: this.props.isLoading,
        error: this.props.error,
        index: 0,
        length: 0,
        itemWidth: 0,
        itemHeight: 0,
        columns: 0,
        rows: 0
      };
    },

    componentWillMount: function () {
      this.isDoneFetching = !this.props.fetch;
      if (this.props.fetchInitially) this.fetch();
    },

    componentDidMount: function () {
      this.update();
    },

    componentWillUnmount: function () {
      cancelAnimationFrame(this.afid);
    },

    shouldComponentUpdate: function (props, state) {
      return !isEqual(this.props, props) || !isEqual(this.state, state);
    },

    getScrollParent: function () {
      if (this._scrollParent) return this._scrollParent;
      for (var el = this.getDOMNode(); el; el = el.parentElement) {
        var overflowY = window.getComputedStyle(el).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') return el;
      }
      return window;
    },

    // Get scroll position relative to the top of the list.
    getScroll: function () {
      var scrollParent = this.getScrollParent();
      var el = this.getDOMNode();
      if (scrollParent === el) {
        return el.scrollTop;
      } else if (scrollParent === window) {
        return -el.getBoundingClientRect().top;
      } else {
        return scrollParent.scrollTop - el.offsetTop
      }
    },

    setScroll: function (y) {
      var scrollParent = this.getScrollParent();
      if (scrollParent === window) return window.scrollTo(0, y);
      scrollParent.scrollTop = y;
    },

    getViewportHeight: function () {
      var scrollParent = this.getScrollParent();
      return scrollParent === window ?
        scrollParent.innerHeight :
        scrollParent.clientHeight
    },

    scrollTo: function (item) {
      var items = this.props.items;
      var targetIndex = items.indexOf(item);
      if (targetIndex === -1) return;
      var itemHeight = this.state.itemHeight;
      var current = this.getScroll();
      var max = Math.floor(targetIndex / this.state.columns) * itemHeight;
      var min = max - this.getViewportHeight() + itemHeight;
      if (current > max) return this.setScroll(max);
      if (current < min) this.setScroll(min);
    },

    handleFetchResult: function (er, isDone) {
      if (!er && isDone) this.isDoneFetching = true;
      this.setState({isLoading: false, error: er});
    },

    fetch: function () {
      if (this.isDoneFetching || this.state.isLoading || this.state.error) {
        return;
      }
      this.setState({isLoading: true, error: null});
      this.props.fetch(this.props.items, this.handleFetchResult);
    },

    // REFACTOR
    update: function () {
      this.afid = requestAnimationFrame(this.update);
      var items = this.props.items;
      var uniform = this.props.uniform;
      var scroll = this.getScroll();
      var itemWidth = this.state.itemWidth;
      var itemHeight = this.state.itemHeight;
      var columns = this.state.columns;
      var rows = this.state.rows;
      var index = this.state.index;
      var length = this.state.length;
      if (uniform) {

        // Grab the item elements.
        var itemEls = this.refs.items.getDOMNode().children;

        // Set itemWidth and itemHeight based on the first item.
        if (itemEls.length) {
          itemWidth = itemEls[0].offsetWidth;
          itemHeight = itemEls[0].offsetHeight;

          var top = itemEls[0].offsetTop;
          var columns = 1;
          for (var i = 1, l = itemEls.length; i < l; ++i) {
            if (itemEls[i].offsetTop !== top) break;
            ++columns;
          }
          rows = Math.ceil(this.getViewportHeight() / itemHeight);

          var rowThreshold = Math.ceil(this.props.threshold / itemHeight);

          length = columns * (rows + rowThreshold * 2);
          index = Math.max(
            0,
            Math.min(
              (items.length + columns) - (items.length % columns) - length,
              (Math.floor(scroll / itemHeight) - rowThreshold) * columns
            )
          );
        } else {
          length = this.props.renderPageSize;
        }
      } else if (length <= items.length) {
        var listBottom = this.getDOMNode().scrollHeight - this.props.threshold;
        var visibleBottom = scroll + this.getViewportHeight();
        if (listBottom < visibleBottom) length += this.props.renderPageSize;
      }

      // Fetch if the models in memory have been exhausted.
      if (index + length > items.length) this.fetch();

      // Finally, set the new state.
      this.setState({
        itemWidth: itemWidth,
        itemHeight: itemHeight,
        columns: columns,
        rows: rows,
        index: index,
        length: length
      });
    },

    renderSpace: function (n) {
      if (!this.props.uniform || !this.state.columns) return;
      var height = (n / this.state.columns) * this.state.itemHeight;
      return DOM.div({style: {height: height}});
    },

    renderSpaceAbove: function () {
      return this.renderSpace(this.state.index);
    },

    renderSpaceBelow: function () {
      var n = this.props.items.length - this.state.index - this.state.length;
      return this.renderSpace(Math.max(0, n));
    },

    renderItems: function () {
      return DOM.div({ref: 'items'}, this.props.items
        .slice(this.state.index, this.state.index + this.state.length)
        .map(this.props.renderItem)
      );
    },

    renderStatusMessage: function () {
      var info = this.props.fetch ? this.state : this.props;
      if (info.isLoading) return this.props.renderLoading();
      if (info.error) return this.props.renderError(info.error);
      if (!this.props.items.length) return this.props.renderEmpty();
    },

    render: function () {
      var Component = this.props.component;
      return this.transferPropsTo(
        Component(null,
          this.renderSpaceAbove(),
          this.renderItems(),
          this.renderSpaceBelow(),
          this.renderStatusMessage()
        )
      );
    }
  });
});
