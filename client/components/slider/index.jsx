/* eslint-disable jsx-a11y/no-noninteractive-tabindex */
/* eslint-disable jsx-a11y/no-onchange */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */

/** 
 * Credit for this slider must go to https://github.com/mpowaga/react-slider, 
 * which was the basis for this implementation
 */
var React = require( 'react' ),
	ScreenReaderText = require( '../screen-reader-text' );

require( './style.scss' );

/**
 * To prevent text selection while dragging.
 * @see http://stackoverflow.com/questions/5429827/how-can-i-prevent-text-element-selection-with-cursor-drag
 * @param {event} e - the event
 * @returns {boolean} false
 */
function pauseEvent( e ) {
	if ( e.stopPropagation ) {
		e.stopPropagation();
	}
	if ( e.preventDefault ) {
		e.preventDefault();
	}
	e.cancelBubble = true;
	e.returnValue = false;
	return false;
}

function stopPropagation( e ) {
	if ( e.stopPropagation ) {
		e.stopPropagation();
	}
	e.cancelBubble = true;
}

/**
 * Spreads `count` values equally between `min` and `max`.
 * @param {int} min - the minimum value
 * @param {int} max - the maximum value
 * @param {int} count - the number of ticks
 * @returns {array} - array of evenly spread values
 */
function linspace( min, max, count ) {
	var range = ( max - min ) / ( count - 1 );
	var res = [];
	for ( let i = 0; i < count; i++ ) {
		res.push( min + range * i );
	}
	return res;
}

function ensureArray( x ) {
	if ( x === null ) {
		return [];
	}

	if ( Array.isArray( x ) ) {
		return x;
	}

	return [x];
}

function undoEnsureArray( x ) {
	return x !== null && x.length === 1 ? x[0] : x;
}

let ReactSlider = React.createClass( {
	displayName: 'ReactSlider',

	propTypes: {

		/**
		 * The minimum value of the slider.
		 */
		min: React.PropTypes.number,

		/**
		 * The maximum value of the slider.
		 */
		max: React.PropTypes.number,

		/**
		 * Value to be added or subtracted on each step the slider makes.
		 * Must be greater than zero.
		 * `max - min` should be evenly divisible by the step value.
		 */
		step: React.PropTypes.number,

		/**
		 * The minimal distance between any pair of handles.
		 * Must be positive, but zero means they can sit on top of each other.
		 */
		minDistance: React.PropTypes.number,

		/**
		 * Determines the initial positions of the handles and the number of handles if the component has no children.
		 *
		 * If a number is passed a slider with one handle will be rendered.
		 * If an array is passed each value will determine the position of one handle.
		 * The values in the array must be sorted.
		 * If the component has children, the length of the array must match the number of children.
		 */
		defaultValue: React.PropTypes.oneOfType( [
			React.PropTypes.number,
			React.PropTypes.arrayOf( React.PropTypes.number )
		] ),

		/**
		 * Like `defaultValue` but for [controlled components]( http://facebook.github.io/react/docs/forms.html#controlled-components ).
		 */
		value: React.PropTypes.oneOfType( [
			React.PropTypes.number,
			React.PropTypes.arrayOf( React.PropTypes.number )
		] ),

		/**
		 * Skip any of this array of values, if in "step" mode
		 **/
		skipValues: React.PropTypes.array,

		/**
		 * Determines whether the slider moves horizontally ( from left to right ) or vertically ( from top to bottom ).
		 */
		orientation: React.PropTypes.oneOf( ['horizontal', 'vertical'] ),

		/**
		 * The css class set on the slider node.
		 */
		className: React.PropTypes.string,

		/**
		 * The css class set on each handle node.
		 *
		 * In addition each handle will receive a numbered css class of the form `${handleClassName}-${i}`,
		 * e.g. `handle-0`, `handle-1`, ...
		 */
		handleClassName: React.PropTypes.string,

		/**
		 * The css class set on the handle that is currently being moved.
		 */
		handleActiveClassName: React.PropTypes.string,

		/**
		 * If `true` bars between the handles will be rendered.
		 */
		withBars: React.PropTypes.bool,

		/**
		 * The css class set on the bars between the handles.
		 * In addition bar fragment will receive a numbered css class of the form `${barClassName}-${i}`,
		 * e.g. `bar-0`, `bar-1`, ...
		 */
		barClassName: React.PropTypes.string,

		/**
		 * If `true` the active handle will push other handles
		 * within the constraints of `min`, `max`, `step` and `minDistance`.
		 */
		pearling: React.PropTypes.bool,

		/**
		 * If `true` the handles can't be moved.
		 */
		disabled: React.PropTypes.bool,

		/**
		 * Disables handle move when clicking the slider bar
		 */
		snapDragDisabled: React.PropTypes.bool,

		/**
		 * Inverts the slider.
		 */
		invert: React.PropTypes.bool,

		/**
		 * Callback called before starting to move a handle.
		 */
		onBeforeChange: React.PropTypes.func,

		/**
		 * Callback called on every value change.
		 */
		onChange: React.PropTypes.func,

		/**
		 * Callback called only after moving a handle has ended.
		 */
		onAfterChange: React.PropTypes.func,

		/**
		 *  Callback called when the the slider is clicked ( handle or bars ).
		 *  Receives the value at the clicked position as argument.
		 */
		onSliderClick: React.PropTypes.func,

		tabIndex: React.PropTypes.number
	},

	getDefaultProps: function() {
		return {
			min: 0,
			max: 100,
			step: 1,
			tabIndex: 0,
			'aria-label': 'slider',
			minDistance: 0,
			defaultValue: 0,
			orientation: 'horizontal',
			className: 'dops-slider',
			handleClassName: 'handle',
			handleActiveClassName: 'active',
			barClassName: 'bar',
			withBars: false,
			pearling: false,
			disabled: false,
			snapDragDisabled: false,
			invert: false
		};
	},

	getInitialState: function() {
		var value = this._or( ensureArray( this.props.value ), ensureArray( this.props.defaultValue ) );
		var zIndices = [];

		// reused throughout the component to store results of iterations over `value`
		this.tempArray = value.slice();

		for ( let i = 0; i < value.length; i++ ) {
			value[i] = this._trimAlignValue( value[i], this.props );
			zIndices.push( i );
		}

		return {
			index: -1,
			upperBound: 0,
			sliderLength: 0,
			value: value,
			zIndices: zIndices
		};
	},

	// Keep the internal `value` consistent with an outside `value` if present.
	// This basically allows the slider to be a controlled component.
	componentWillReceiveProps: function( newProps ) {
		var value = this._or( ensureArray( newProps.value ), this.state.value );

		// ensure the array keeps the same size as `value`
		this.tempArray = value.slice();

		for ( let i = 0; i < value.length; i++ ) {
			this.state.value[i] = this._trimAlignValue( value[i], newProps );
		}
		if ( this.state.value.length > value.length ) {
			this.state.value.length = value.length;
		}
		// If an upperBound has not yet been determined ( due to the component being hidden
		// during the mount event, or during the last resize ), then calculate it now
		if ( this.state.upperBound === 0 ) {
			this._handleResize();
		}
	},

	// Check if the arity of `value` or `defaultValue` matches the number of children ( = number of custom handles ).
	// If no custom handles are provided, just returns `value` if present and `defaultValue` otherwise.
	// If custom handles are present but neither `value` nor `defaultValue` are applicable the handles are spread out
	// equally.
	_or: function( value, defaultValue ) {
		var count = React.Children.count( this.props.children );
		switch ( count ) {
			case 0:
				return value.length > 0 ? value : defaultValue;
			case value.length:
				return value;
			case defaultValue.length:
				return defaultValue;
			default:
				if ( value.length !== count || defaultValue.length !== count ) {
					console.warn( this.constructor.displayName + ': Number of values does not match number of children.' );
				}
				return linspace( this.props.min, this.props.max, count );
		}
	},

	componentDidMount: function() {
		window.addEventListener( 'resize', this._handleResize );
		this._handleResize();
	},

	componentWillUnmount: function() {
		window.removeEventListener( 'resize', this._handleResize );
	},

	getValue: function() {
		return undoEnsureArray( this.state.value );
	},

	_handleResize: function() {
		// setTimeout of 0 gives element enough time to have assumed its new size if it is being resized
		window.setTimeout( function() {
			if ( ! this.refs.slider ) {
				// perhaps it belongs to a window that's been closed
				return;
			}
			let slider = this.refs.slider.getDOMNode();
			let handle = this.refs.handle0.getDOMNode();
			let rect = slider.getBoundingClientRect();

			let size = this._sizeKey();

			let sliderMax = rect[this._posMaxKey()];
			let sliderMin = rect[this._posMinKey()];

			this.setState( {
				upperBound: slider[size] - handle[size],
				sliderLength: Math.abs( sliderMax - sliderMin ),
				handleSize: handle[size],
				sliderStart: this.props.invert ? sliderMax : sliderMin
			} );
		}.bind( this ), 0 );
	},

	// calculates the offset of a handle in pixels based on its value.
	_calcOffset: function( value ) {
		var ratio = ( value - this.props.min ) / ( this.props.max - this.props.min );
		return ratio * this.state.upperBound;
	},

	// calculates the value corresponding to a given pixel offset, i.e. the inverse of `_calcOffset`.
	_calcValue: function( offset ) {
		var ratio = offset / this.state.upperBound;
		return ratio * ( this.props.max - this.props.min ) + this.props.min;
	},

	_buildHandleStyle: function( offset, i ) {
		var style = {
			position: 'absolute',
			willChange: this.state.index >= 0 ? this._posMinKey() : '',
			zIndex: this.state.zIndices.indexOf( i ) + 1
		};
		style[this._posMinKey()] = offset + 'px';
		return style;
	},

	_buildBarStyle: function( min, max ) {
		var obj = {
			position: 'absolute',
			willChange: this.state.index >= 0 ? this._posMinKey() + ',' + this._posMaxKey() : ''
		};
		obj[this._posMinKey()] = min;
		obj[this._posMaxKey()] = max;
		return obj;
	},

	_getClosestIndex: function( pixelOffset ) {
		var minDist = Number.MAX_VALUE;
		var closestIndex = -1;

		var value = this.state.value;
		var l = value.length;

		for ( let i = 0; i < l; i++ ) {
			let offset = this._calcOffset( value[i] );
			let dist = Math.abs( pixelOffset - offset );
			if ( dist < minDist ) {
				minDist = dist;
				closestIndex = i;
			}
		}

		return closestIndex;
	},

	_calcOffsetFromPosition: function( position ) {
		var pixelOffset = position - this.state.sliderStart;
		if ( this.props.invert ) {
			pixelOffset = this.state.sliderLength - pixelOffset;
		}
		pixelOffset -= ( this.state.handleSize / 2 );
		return pixelOffset;
	},

	// Snaps the nearest handle to the value corresponding to `position` and calls `callback` with that handle's index.
	_forceValueFromPosition: function( position, callback ) {
		var pixelOffset = this._calcOffsetFromPosition( position );
		var closestIndex = this._getClosestIndex( pixelOffset );
		var nextValue = this._trimAlignValue( this._calcValue( pixelOffset ) );

		var value = this.state.value.slice(); // Clone this.state.value since we'll modify it temporarily
		value[closestIndex] = nextValue;

		// Prevents the slider from shrinking below `props.minDistance`
		for ( let i = 0; i < value.length - 1; i += 1 ) {
			if ( value[i + 1] - value[i] < this.props.minDistance ) {
				return;
			}
		}

		this.setState( {
			value: value
		}, callback.bind( this, closestIndex ) );
	},

	_getMousePosition: function( e ) {
		return [
			e['page' + this._axisKey()],
			e['page' + this._orthogonalAxisKey()]
		];
	},

	_getTouchPosition: function( e ) {
		var touch = e.touches[0];
		return [
			touch['page' + this._axisKey()],
			touch['page' + this._orthogonalAxisKey()]
		];
	},

	_getMouseEventMap: function() {
		return {
			mousemove: this._onMouseMove,
			mouseup: this._onMouseUp
		};
	},

	_getTouchEventMap: function() {
		return {
			touchmove: this._onTouchMove,
			touchend: this._onTouchEnd
		};
	},

	// create the `mousedown` handler for the i-th handle
	_createOnMouseDown: function( i ) {
		return function( e ) {
			if ( this.props.disabled ) {
				return;
			}
			let position = this._getMousePosition( e );
			this._start( i, position[0] );
			this._addHandlers( this._getMouseEventMap() );
			pauseEvent( e );
		}.bind( this );
	},

	// create the `touchstart` handler for the i-th handle
	_createOnTouchStart: function( i ) {
		return function( e ) {
			if ( this.props.disabled || e.touches.length > 1 ) {
				return;
			}
			let position = this._getTouchPosition( e );
			this.startPosition = position;
			this.isScrolling = undefined; // don't know yet if the user is trying to scroll
			this._start( i, position[0] );
			this._addHandlers( this._getTouchEventMap() );
			stopPropagation( e );
		}.bind( this );
	},

	_addHandlers: function( eventMap ) {
		for ( let key in eventMap ) {
			document.addEventListener( key, eventMap[key], false );
		}
	},

	_removeHandlers: function( eventMap ) {
		for ( let key in eventMap ) {
			document.removeEventListener( key, eventMap[key], false );
		}
	},

	_start: function( i, position ) {
		// if activeElement is body window will lost focus in IE9
		if ( document.activeElement && document.activeElement !== document.body ) {
			document.activeElement.blur();
		}

		this.hasMoved = false;

		this._fireChangeEvent( 'onBeforeChange' );

		let zIndices = this.state.zIndices;
		zIndices.splice( zIndices.indexOf( i ), 1 ); // remove wherever the element is
		zIndices.push( i ); // add to end

		this.setState( {
			startValue: this.state.value[i],
			startPosition: position,
			index: i,
			zIndices: zIndices
		} );
	},

	_onMouseUp: function() {
		this._onEnd( this._getMouseEventMap() );
	},

	_onTouchEnd: function() {
		this._onEnd( this._getTouchEventMap() );
	},

	_onEnd: function( eventMap ) {
		this._removeHandlers( eventMap );
		this.setState( {
			index: -1
		}, this._fireChangeEvent.bind( this, 'onAfterChange' ) );
	},

	_onMouseMove: function( e ) {
		var position = this._getMousePosition( e );
		this._move( position[0] );
	},

	_onTouchMove: function( e ) {
		if ( e.touches.length > 1 ) {
			return;
		}

		let position = this._getTouchPosition( e );

		if ( typeof this.isScrolling === 'undefined' ) {
			let diffMainDir = position[0] - this.startPosition[0];
			let diffScrollDir = position[1] - this.startPosition[1];
			this.isScrolling = Math.abs( diffScrollDir ) > Math.abs( diffMainDir );
		}

		if ( this.isScrolling ) {
			this.setState( {
				index: -1
			} );
			return;
		}

		pauseEvent( e );

		this._move( position[0] );
	},

	_move: function( position ) {
		this.hasMoved = true;

		let props = this.props;
		let state = this.state;
		let index = state.index;

		let value = state.value;
		let l = value.length;
		let oldValue = value[index];

		let diffPosition = position - state.startPosition;
		if ( props.invert ) {
			diffPosition *= -1;
		}

		let diffValue = diffPosition / ( state.sliderLength - state.handleSize ) * ( props.max - props.min );
		let newValue = this._trimAlignValue( state.startValue + diffValue );

		let minDistance = props.minDistance;

		// if "pearling" ( = handles pushing each other ) is disabled,
		// prevent the handle from getting closer than `minDistance` to the previous or next handle.
		if ( !props.pearling ) {
			if ( index > 0 ) {
				let valueBefore = value[index - 1];
				if ( newValue < valueBefore + minDistance ) {
					newValue = valueBefore + minDistance;
				}
			}

			if ( index < l - 1 ) {
				let valueAfter = value[index + 1];
				if ( newValue > valueAfter - minDistance ) {
					newValue = valueAfter - minDistance;
				}
			}
		}

		value[index] = newValue;

		// if "pearling" is enabled, let the current handle push the pre- and succeeding handles.
		if ( props.pearling && l > 1 ) {
			if ( newValue > oldValue ) {
				this._pushSucceeding( l, value, minDistance, index );
				this._trimSucceeding( l, value, minDistance, props.max );
			} else if ( newValue < oldValue ) {
				this._pushPreceding( l, value, minDistance, index );
				this._trimPreceding( l, value, minDistance, props.min );
			}
		}

		// Normally you would use `shouldComponentUpdate`, but since the slider is a low-level component,
		// the extra complexity might be worth the extra performance.
		if ( newValue !== oldValue ) {
			this.setState( {
				value: value
			}, this._fireChangeEvent.bind( this, 'onChange' ) );
		}
	},

	_pushSucceeding: function( l, value, minDistance, index ) {
		var i, padding;
		for ( i = index, padding = value[i] + minDistance; value[i + 1] !== null && padding > value[i + 1]; i++, padding = value[i] + minDistance ) {
			value[i + 1] = this._alignValue( padding );
		}
	},

	_trimSucceeding: function( l, nextValue, minDistance, max ) {
		for ( let i = 0; i < l; i++ ) {
			let padding = max - i * minDistance;
			if ( nextValue[l - 1 - i] > padding ) {
				nextValue[l - 1 - i] = padding;
			}
		}
	},

	_pushPreceding: function( l, value, minDistance, index ) {
		var i, padding;
		for ( i = index, padding = value[i] - minDistance; value[i - 1] !== null && padding < value[i - 1]; i--, padding = value[i] - minDistance ) {
			value[i - 1] = this._alignValue( padding );
		}
	},

	_trimPreceding: function( l, nextValue, minDistance, min ) {
		for ( let i = 0; i < l; i++ ) {
			let padding = min + i * minDistance;
			if ( nextValue[i] < padding ) {
				nextValue[i] = padding;
			}
		}
	},

	_axisKey: function() {
		var orientation = this.props.orientation;
		if ( orientation === 'horizontal' ) {
			return 'X';
		}
		if ( orientation === 'vertical' ) {
			return 'Y';
		}
	},

	_orthogonalAxisKey: function() {
		var orientation = this.props.orientation;
		if ( orientation === 'horizontal' ) {
			return 'Y';
		}
		if ( orientation === 'vertical' ) {
			return 'X';
		}
	},

	_posMinKey: function() {
		var orientation = this.props.orientation;
		if ( orientation === 'horizontal' ) {
			return this.props.invert ? 'right' : 'left';
		}
		if ( orientation === 'vertical' ) {
			return this.props.invert ? 'bottom' : 'top';
		}
	},

	_posMaxKey: function() {
		var orientation = this.props.orientation;
		if ( orientation === 'horizontal' ) {
			return this.props.invert ? 'left' : 'right';
		}
		if ( orientation === 'vertical' ) {
			return this.props.invert ? 'top' : 'bottom';
		}
	},

	_sizeKey: function() {
		var orientation = this.props.orientation;
		if ( orientation === 'horizontal' ) {
			return 'clientWidth';
		}
		if ( orientation === 'vertical' ) {
			return 'clientHeight';
		}
	},

	_trimAlignValue: function( val, props ) {
		return this._alignValue( this._trimValue( val, props ), props );
	},

	_trimValue: function( val, props ) {
		props = props || this.props;

		if ( val <= props.min ) {
			val = props.min;
		}
		if ( val >= props.max ) {
			val = props.max;
		}

		return val;
	},

	_alignValue: function( val, props ) {
		props = props || this.props;

		let valModStep = ( val - props.min ) % props.step;
		let alignValue = val - valModStep;

		if ( Math.abs( valModStep ) * 2 >= props.step ) {
			alignValue += ( valModStep > 0 ) ? props.step : ( -props.step );
		}

		// check if this is a value that we shouldn't align to
		if ( this.props.skipValues && this.props.skipValues.indexOf( alignValue ) >= 0 ) {
			// check if we can go down
			if ( alignValue - props.step >= this.props.min ) {
				alignValue -= props.step;
			} else {
				alignValue += props.step;
			}
		}

		return parseFloat( alignValue.toFixed( 5 ) );
	},

	_renderHandle: function( style, child, i ) {
		var className = this.props.handleClassName + ' ' +
			( this.props.handleClassName + '-' + i ) + ' ' +
			( this.state.index === i ? this.props.handleActiveClassName : '' );

		var options = [];
		for ( let val = this.props.min; val <= this.props.max; val += this.props.step ) {
			if ( -1 === this.props.skipValues.indexOf( val ) ) {
				options.push(
					<option value={ val }>{ '$' + val + '.00' }</option>
				);
			}
		};

		return (
			<div key={ 'handle' + i }>
				<div
					data-index={ i }
					ref={ 'handle' + i }
					className={ className }
					style={ style }
					aria-hidden={ true }
					tabIndex='0'
					onKeyDown={ this._handleKeyDown }
					onMouseDown={ this._createOnMouseDown( i ) }
					onTouchStart={ this._createOnTouchStart( i ) }>
					{ child }
				</div>
				<ScreenReaderText>
					<select data-index={ i } onChange={ this._handleShadowInput }>
						{ options }
					</select>
				</ScreenReaderText>
			</div>
		);
	},

	_renderHandles: function( offset ) {
		var l = offset.length;

		var styles = this.tempArray;
		for ( let i = 0; i < l; i++ ) {
			styles[i] = this._buildHandleStyle( offset[i], i );
		}

		let res = this.tempArray;
		let renderHandle = this._renderHandle;
		if ( React.Children.count( this.props.children ) > 0 ) {
			React.Children.forEach( this.props.children, function( child, index ) {
				res[index] = renderHandle( styles[index], child, index );
			} );
		} else {
			for ( i = 0; i < l; i++ ) {
				res[i] = renderHandle( styles[i], null, i );
			}
		}
		return res;
	},

	_renderBar: function( i, offsetFrom, offsetTo ) {
		var className = this.props.barClassName + ' ' + this.props.barClassName + '-' + i,
			style = this._buildBarStyle( offsetFrom, this.state.upperBound - offsetTo );

		return (
			<div key={'bar' + i} ref={'bar' + i} className={className} style={style} />
		);
	},

	_renderBars: function( offset ) {
		var bars = [];
		var lastIndex = offset.length - 1;

		bars.push( this._renderBar( 0, 0, offset[0] ) );

		for ( let i = 0; i < lastIndex; i++ ) {
			bars.push( this._renderBar( i + 1, offset[i], offset[i + 1] ) );
		}

		bars.push( this._renderBar( lastIndex + 1, offset[lastIndex], this.state.upperBound ) );

		return bars;
	},

	_onSliderMouseDown: function( e ) {
		if ( this.props.disabled ) {
			return;
		}
		this.hasMoved = false;
		if ( !this.props.snapDragDisabled ) {
			let position = this._getMousePosition( e );
			this._forceValueFromPosition( position[0], function( i ) {
				this._fireChangeEvent( 'onChange' );
				this._start( i, position[0] );
				this._addHandlers( this._getMouseEventMap() );
			}.bind( this ) );
		}

		pauseEvent( e );
	},

	_onSliderClick: function( e ) {
		if ( this.props.disabled ) {
			return;
		}

		if ( this.props.onSliderClick && !this.hasMoved ) {
			let position = this._getMousePosition( e );
			let valueAtPos = this._trimAlignValue( this._calcValue( this._calcOffsetFromPosition( position[0] ) ) );
			this.props.onSliderClick( valueAtPos );
		}
	},

	_fireChangeEvent: function( event ) {
		if ( this.props[event] ) {
			this.props[event]( undoEnsureArray( this.state.value ) );
		}
	},

	_stepHandle: function( valueIndex, increment ) {
		let allValues = this.state.value;
		let value = allValues[ valueIndex ];

		if ( increment ) {
			value += this.props.step;
		} else {
			value -= this.props.step;
		}

		allValues[ valueIndex ] = this._trimAlignValue( value );
		// Check max & min
		this.setState( { value: allValues }, this._fireChangeEvent.bind( this, 'onChange' ) );
	},

	_handleKeyDown: function( e ) {
		e.stopPropagation();
		let i = 0;

		if ( 'undefined' !== e.target.dataset.index ) {
			i = e.target.dataset.index;
		}

		switch ( e.which ) {
			case 38: // Up
			case 39: // Right
				this._stepHandle( i, true );
				break;
			case 40: // Down
			case 37: // Left
				this._stepHandle( i, false );
				break;
			default:
				return;
		}
	},

	_handleShadowInput: function( e ) {
		e.stopPropagation();
		let valueIndex = 0;
		let allValues = this.state.value;

		if ( 'undefined' !== e.target.dataset.index ) {
			valueIndex = e.target.dataset.index;
		}

		let value = allValues[ valueIndex ];

		// @todo Don't hardcode this.props.skipValues
		if ( 6 === parseInt( e.target.value ) ) {
			if ( 0 === parseInt( value ) ) {
				value = 12;
			} else {
				value = 0;
			}
		} else {
			value = e.target.value;
		}

		allValues[ valueIndex ] = this._trimAlignValue( value );
		this.setState( { value: allValues }, this._fireChangeEvent.bind( this, 'onChange' ) );
	},

	render: function() {
		var state = this.state;
		var props = this.props;

		var offset = this.tempArray;
		var value = state.value;
		var l = value.length;
		for ( let i = 0; i < l; i++ ) {
			offset[i] = this._calcOffset( value[i], i );
		}

		let bars = props.withBars ? this._renderBars( offset ) : null;
		let handles = this._renderHandles( offset );

		let className = props.className + ( props.disabled ? ' disabled' : '' );

		return (
			<div ref='slider'
				id={ this.props.id }
				style={ this.props.style }
				className={ className }
				onMouseDown={ this._onSliderMouseDown }
				onClick={ this._onSliderClick } >
				{ bars }
				{ handles }
			</div>
		);
	}
} );

module.exports = ReactSlider;
