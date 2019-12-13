import * as React from 'react';
import { PureComponent } from 'react';
import { scrollbarWidth } from '@tolkam/lib-utils-ui';
import Portal from '@tolkam/react-portal';
import Animatable from '@tolkam/react-animatable';
import { Transition, CSSTransition } from 'react-transition-group';

const DOCUMENT = document;
const HTML = document.documentElement;

const OPENING = 'OPENING';
const OPENED = 'OPENED';
const CLOSING = 'CLOSING';
const CLOSED = 'CLOSED';

/**
 * Parent element styles cache
 * @type {String}
 */
let parentStyleCache: string;

/**
 * Html element styles cache
 * @type {String}
 */
let htmlStyleCache: string;

/**
 * Current active modals ids
 * @type {Array}
 */
let nextId = 0;
const activeIds: any[] = [];

/**
 * Modal window component
 */
export default class Modal extends PureComponent<Props, any> {

    /**
     * Default props
     * @type {Props}
     */
    public static defaultProps: Props = {
        show: false,
        appendTo: DOCUMENT.body,
        onCloseRequest: () => {}
    }

    /**
     * Instance id
     * @type {string | number}
     */
    protected id: string | number;

    /**
     * Rendered modal element
     * @type {HTMLElement}
     */
    protected element: HTMLElement;

    /**
     * Previously focused element
     * @type {any}
     */
    protected prevFocused: any;

    /**
     * Current animated elements count
     * @type {Number}
     */
    protected animated: number = 0;


    constructor(props: Props, context: any) {
        super(props, context);
        const that = this;

        that.state = {
            stage: CLOSED,
        }

        // obtain new id
        that.id = props.id || ++nextId;
    }

    public componentDidMount() {
        // this.changeStage(this.props.show ? OPENING : CLOSING);
        if(this.props.show) {
            this.changeStage(OPENING);
        }
    }

    public componentWillReceiveProps(nextProps: Props) {
        // console.log('got props', nextProps);
        this.changeStage(nextProps.show ? OPENING : CLOSING);
    }

    public componentDidUpdate(prevProps: Props, prevState: any) {
        const that = this;
        const stage = that.state.stage;

        if (stage === prevState.stage) {
            // console.log('%s ...no stage changed, nothing to do', this.id);
            return;
        }

        if (stage === OPENING) {
            // console.log('%s on opening...', this.id);
            that.onOpening();
        } else if (stage === OPENED) {
            // console.log('%s on opened...', this.id);
            that.onOpened();
        } else if (stage === CLOSED) {
            // console.log('%s on unmount...', this.id);
            that.cleanup();
        }
    }

    public componentWillUnmount() {
        const that = this;
        const currentStatge = that.state.stage;
        if (currentStatge !== CLOSED) {
            that.cleanup();
        }
    }

    public render() {
        const that = this;
        const props = that.props;
        const className = props.className || 'modal';
        const state = that.state.stage;
        let backdrop: any;

        if (state === CLOSED) {
            return null;
        }

        const animationAwareProps = {
            show: state !== CLOSING,
            onCompleted: that.changeStage.bind(that, CLOSED),
            onEntered: that.changeStage.bind(that, OPENED),
            animateAppear: true,
        };

        if (!props.noBackdrop) {
            backdrop = <Animatable {...animationAwareProps}>
                <span className="backdrop" onClick={that.onClick} />
            </Animatable>;
        }

        return <Portal to={(props.appendTo as HTMLElement)}>
            <div className={className} tabIndex={-1} ref={(e: any) => that.element = e}>
                <Animatable {...animationAwareProps}>
                    <div className="body">{props.children}</div>
                </Animatable>
                {backdrop}
            </div>
        </Portal>
    }

    /**
     * Changes current stage
     *
     * @param  {mixed} stage
     * @return {void}
     */
    protected changeStage(stage: any) {
        const that = this;
        const prevStage = that.state.stage;

        // const msg = this.id + ' next stage: ' + stage;

        if (prevStage === stage) {
            // console.log('%s - same stages, stop', msg);
            return;
        }

        if (!stage
            || prevStage === CLOSED && stage === CLOSING
            || prevStage === OPENED && stage === OPENING
        ) {
            // console.log('%s - no changes required', msg);
            return;
        }

        // console.log(msg + '...');

        if (stage === CLOSED || stage === OPENED) {

            // decrease animated count and
            // stop if has pending animations
            that.animated--;
            if (that.animated > 0) {
                // console.log('%s waiting for all animations to complete...', msg);
                return;
            }
            // console.log('%s animations completed...', msg);

        } else {

            // keep actual registered animations count
            that.animated = that.props.noBackdrop ? 1 : 2;
        }

        that.setState({ stage });
    }

    /**
     * Handles opening stage
     *
     * @return {void}
     */
    protected onOpening() {
        const that = this;
        const { allowScroll, appendTo } = that.props;

        // listen to keyboard events
        DOCUMENT.addEventListener('keydown', that.onKeydown);

        // listen to document clicks
        DOCUMENT.addEventListener('click', that.onDocClick);

        // add to active modals
        activeIds.push(that.id);

        // if first active modal
        if (!allowScroll && activeIds.length === 1) {
            parentStyleCache = disableElementScoll(appendTo as HTMLElement);
            htmlStyleCache = disableElementScoll(HTML);
        }

        // console.log('%s ...on opening', this.id);
    }

    /**
     * Handles opened stage
     *
     * @return {void}
     */
    protected onOpened() {
        const that = this;
        const { onOpen } = that.props;

        // store prev focused element
        that.prevFocused = DOCUMENT.activeElement;

        // focus element
        (that.element as any).focus();

        // open callback
        onOpen && onOpen();

        // console.log('%s ...on opened', this.id);
    }

    /**
     * Handles mouse events
     *
     * @param  {MouseEvent} e
     * @return {void}
     */
    protected onClick = (e: any) => {
        (this.props.onCloseRequest as Function)();
    }

    /**
     * Handles keyboard events
     *
     * @param  {KeyboardEvent} e
     * @return {void}
     */
    protected onKeydown = (e: KeyboardEvent) => {

        // escape key and current modal is on top
        if (e.key === 'Escape' && activeIds.lastIndexOf(this.id) === activeIds.length - 1) {
            e.preventDefault();
            (this.props.onCloseRequest as Function)();
        }
    }

    /**
     * Handles document clicks
     *
     * @param  {MouseEvent} e
     * @return {void}
     */
    protected onDocClick = (e: any) => {
        const that = this;
        const props = that.props;

        if (props.withDocumentClicks) {
            const target = e.target;
            const element = that.element;

            if (target !== element && !element.contains(target)) {
                (this.props.onCloseRequest as Function)();
            }
        }
    }

    /**
     * Cleans things up
     *
     * @return {void}
     */
    protected cleanup = () => {
        const that = this;
        const { appendTo, onClose } = that.props;
        const prevFocused = that.prevFocused;

        // remove from active modals
        activeIds.splice(activeIds.indexOf(that.id), 1);

        // remove listeners
        DOCUMENT.removeEventListener('keydown', that.onKeydown);
        DOCUMENT.removeEventListener('click', that.onDocClick);

        // restore styles
        if (activeIds.length === 0) {
            if (parentStyleCache != null) {
                (appendTo as HTMLElement).style.cssText = parentStyleCache;
            }

            if (htmlStyleCache != null) {
                HTML.style.cssText = htmlStyleCache;
            }
        }

        // restore focus
        if(prevFocused && typeof prevFocused.focus === 'function') {
            prevFocused.focus();
        }

        // close callback
        onClose && onClose();

        // console.log('%s ...on unmount', this.id);
    }
}

export interface Props extends React.HTMLAttributes<Modal> {

    // whether to show the modal
    show: boolean,

    // modal unique id
    id?: string,

    // parent element to append to
    appendTo?: HTMLElement,

    // without backdrop
    noBackdrop?: boolean,

    // when close requested by mouse or keyboard
    // onCloseRequest?: (e: React.MouseEvent<any> | React.KeyboardEvent<any>) => any,
    onCloseRequest?: () => any,

    // open callback
    onOpen?: () => any,

    // close callback
    onClose?: () => any,

    // allow parent element scrolling
    allowScroll?: boolean,

    // issue "onCloseRequest" on document clicks
    withDocumentClicks?: boolean,
}

/**
 * Disables element scrolling
 *
 * @param  {HTMLElement} element
 * @return {String}      previous style string
 */
function disableElementScoll(element: HTMLElement): string {
    const style = element.style;
    const prevStyleText = style.cssText;
    const computed = window.getComputedStyle(element);
    const yOverflowed = element.clientHeight < element.scrollHeight;
    const xOverflowed = element.clientWidth < element.scrollWidth;
    const scrollBarWidth = scrollbarWidth();
    const paddingRight: string = 'paddingRight';
    const paddingBottom: string = 'paddingBottom';
    const parse = parseFloat;
    const px = 'px';

    if (yOverflowed || xOverflowed) {
        style['overflow' + (yOverflowed ? 'Y' : xOverflowed ? 'X' : '')] = 'hidden';
    }

    if (yOverflowed) {
        style[paddingRight] = (parse(computed[paddingRight]) || 0) + scrollBarWidth + px;
    }

    if(xOverflowed) {
        style[paddingBottom] = (parse(computed[paddingBottom]) || 0) + scrollBarWidth + px;
    }

    return prevStyleText;
}