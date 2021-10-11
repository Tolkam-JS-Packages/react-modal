import * as React from 'react';
import { PureComponent } from 'react';
import { disableScroll } from '@tolkam/lib-utils-ui';
import Portal from '@tolkam/react-portal';
import Animatable from '@tolkam/react-animatable';

const DOCUMENT = document;
const ROOT = DOCUMENT.documentElement;
const BODY = DOCUMENT.body;
const STYLE_CACHE_KEY = 'modalStyleCache';
const SCROLL_DISABLER_KEY = 'scrollDisabledBy';

const OPENING = 'OPENING';
const OPENED = 'OPENED';
const CLOSING = 'CLOSING';
const CLOSED = 'CLOSED';

/**
 * Current active modals ids
 * @type {Number}
 */
let nextId = 0;

/**
 * Map of modal parent elements and its children modals ids
 * @type {Map<HTMLElement, number[]>}
 */
const parents = new Map();

/**
 * Modal window component
 */
export default class Modal extends PureComponent<IProps, IState> {

    /**
     * Default props
     * @type {IProps}
     */
    public static defaultProps: IProps = {
        show: false,
        onCloseRequest: () => {}
    };

    /**
     * Instance id
     * @type {string|number}
     */
    protected id: string|number;

    /**
     * Parent element modal is appended to
     * @type {HTMLElement}
     */
    protected parent: HTMLElement;

    /**
     * Rendered modal element
     * @type {HTMLElement}
     */
    protected element: HTMLElement;

    /**
     * @type {Portal}
     */
    protected portal: Portal;

    /**
     * Previously focused element
     * @type {any}
     */
    protected prevFocused: any;

    /**
     * Current animated elements count
     * @type {number}
     */
    protected animated: number = 0;

    /**
     * @param {IProps} props
     */
    public constructor(props: IProps) {
        super(props);
        const that = this;

        // obtain new id
        that.id = props.id || ++nextId;

        that.parent = props.appendTo || BODY;

        // default state
        that.state = {
            stage: props.show ? OPENED : CLOSED,
        }
    }

    /**
     * @inheritDoc
     */
    public componentDidUpdate() {
        const that = this;
        const curShow = that.props.show;
        const curStage = that.state.stage;

        if(curShow && curStage === CLOSED || !curShow && curStage === OPENED) {
            this.setState({stage: curShow ? OPENING : CLOSING}, curShow ? that.beforeOpen : that.beforeClose);
        }
    }

    /**
     * @inheritDoc
     */
    public componentWillUnmount() {
        this.onClose();
    }

    /**
     * @inheritDoc
     */
    public render() {
        const that = this;
        const props = that.props;
        const className = props.className ?? 'modal';
        const bdClassName = props.classNameBackdrop ?? className + '__backdrop';
        const bodyClassName = props.classNameBody ?? className + '__body';
        const bodyAnimationsPrefix = props.classPrefixBody ?? (bodyClassName + '-');
        const bdAnimationsPrefix = props.classPrefixBackdrop ?? (bdClassName + '-');
        const stage = that.state.stage;
        let backdrop: any;

        if (stage === CLOSED) {
            return null;
        }

        const animationAwareProps = {
            show: stage !== CLOSING,
            onCompleted: that.onClosing,
            onEntered: that.onOpening,
            animateAppear: true,
        };

        if (!props.noBackdrop) {
            backdrop = <Animatable {...animationAwareProps} className={bdClassName} classPrefix={bdAnimationsPrefix}>
                <div onClick={!props.noBackdropClicks ? that.onClick : undefined} />
            </Animatable>;
        }

        return <Portal to={that.parent} ref={(r) => r ? that.portal = r : null}>
            <div className={className} tabIndex={-1}>
                <Animatable {...animationAwareProps} className={bodyClassName} classPrefix={bodyAnimationsPrefix}>
                    <div>{props.children}</div>
                </Animatable>
                {backdrop}
            </div>
        </Portal>
    }

    /**
     * Fires before modal opening
     *
     * @returns {void}
     */
    protected beforeOpen = () => {
        const that = this;
        const { beforeOpen } = that.props;
        beforeOpen && beforeOpen();
        that.disableScroll();
    };

    /**
     * Fires before modal closing
     *
     * @returns {void}
     */
    protected beforeClose = () => {
        const { beforeClose } = this.props;
        beforeClose && beforeClose();
    };

    /**
     * Handles opening phase
     *
     * @returns {void}
     */
    protected onOpening = () => {
        const that = this;
        const expectedCount = that.props.noBackdrop ? 1 : 2;

        that.animated++;
        if (that.animated === expectedCount) {
            that.setState({ stage: OPENED }, that.onOpen);
        }
    };

    /**
     * Handles closing phase
     *
     * @returns {void}
     */
    protected onClosing = () => {
        const that = this;

        that.animated--;
        if (that.animated === 0) {
            that.setState({ stage: CLOSED }, that.onClose);
        }
    };

    /**
     * Handles modal opened state
     *
     * @returns {void}
     */
    protected onOpen() {
        const that = this;
        const { onOpen, noFocus } = that.props;

        that.register();
        that.addDocEvents();

        if(!noFocus) {
            that.storeFocus();
        }

        onOpen && onOpen();
    }

    /**
     * Handles modal closed state
     *
     * @returns {void}
     */
    protected onClose() {
        const that = this;
        const { onClose } = that.props;

        that.unregister();
        that.removeDocEvents();
        that.restoreFocus();
        that.restoreScroll();

        onClose && onClose();
    }

    /**
     * Handles mouse events
     *
     * @return {void}
     */
    protected onClick = () => {
        (this.props.onCloseRequest as Function)();
    };

    /**
     * Handles keyboard events
     *
     * @param  {KeyboardEvent} e
     * @return {void}
     */
    protected onKeydown = (e: KeyboardEvent) => {
        const that = this;

        if (e.key === 'Escape' && that.isOnTop()) {
            e.preventDefault();
            (that.props.onCloseRequest as Function)();
        }
    };

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
            const element = this.portal.getElement();

            if (target !== element && !element.contains(target)) {
                (this.props.onCloseRequest as Function)();
            }
        }
    };

    /**
     * Disables parent elements scroll
     *
     * @returns {void}
     */
    protected disableScroll() {
        let { props, parent } = this;
        const target = parent === BODY ? ROOT : parent;
        const dataset = target.dataset;

        if(props.allowScroll) {
            return;
        }

        if(dataset[STYLE_CACHE_KEY] == null) {
            dataset[STYLE_CACHE_KEY] = disableScroll(target);
            dataset[SCROLL_DISABLER_KEY] = this.id.toString();
        }
    }

    /**
     * Restores parent elements scroll
     *
     * @returns {void}
     */
    protected restoreScroll() {
        const that = this;
        const parent = that.parent;
        const target = parent === BODY ? ROOT : parent;
        const { dataset, style } = target;

        if(dataset[SCROLL_DISABLER_KEY] !== that.id.toString()) {
            return;
        }

        if(dataset[STYLE_CACHE_KEY] != null) {
            style.cssText = dataset[STYLE_CACHE_KEY] || '';
            delete dataset[STYLE_CACHE_KEY];
            delete dataset[SCROLL_DISABLER_KEY];
        }

        if(!style.cssText) {
            target.removeAttribute('style');
        }
    }

    /**
     * Grabs focus
     *
     * @returns {void}
     */
    protected storeFocus() {
        const that = this;
        const element = that.portal.getElement();
        that.prevFocused = DOCUMENT.activeElement;

        element && element.focus();
    }

    /**
     * Restores previous focus
     *
     * @returns {void}
     */
    protected restoreFocus() {
        const prevFocused = this.prevFocused;

        if (prevFocused && typeof prevFocused.focus === 'function') {
            prevFocused.focus();
        }
    }

    /**
     * Adds events listeners
     *
     * @returns {void}
     */
    protected addDocEvents() {
        const that = this;

        if (that.props.withDocumentClicks) {
            DOCUMENT.addEventListener('click', that.onDocClick);
        }

        DOCUMENT.addEventListener('keydown', that.onKeydown);
    }

    /**
     * Removes events listeners
     *
     * @returns {void}
     */
    protected removeDocEvents() {
        const that = this;

        if (that.props.withDocumentClicks) {
            DOCUMENT.removeEventListener('click', that.onDocClick);
        }

        DOCUMENT.removeEventListener('keydown', that.onKeydown);
    }

    /**
     * Registers self as a parents child
     *
     * @returns {void}
     */
    private register() {
        const { parent, id } = this;

        if(!parents.has(parent)) {
            parents.set(parent, [id]);
        } else {
            parents.get(parent).unshift(id);
        }
    }

    /**
     * Deregisters self from parent children
     *
     * @returns {void}
     */
    private unregister() {
        const { parent, id } = this;
        const ids = parents.get(parent);

        if(!ids) {
            return;
        }

        ids.splice(ids.indexOf(id), 1);

        if(!ids.length) {
            parents.delete(parent);
        }
    }

    /**
     * Checks if modal is on top of other siblings
     *
     * @returns {boolean}
     */
    private isOnTop() {
        const that = this;
        const ids = parents.get(that.parent);

        return ids != null && ids[0] === that.id;
    }
}

export interface IProps extends React.HTMLAttributes<Modal> {

    // whether to show the modal
    show: boolean,

    // modal unique id
    id?: string,

    // parent element to append to
    appendTo?: HTMLElement,

    // without backdrop
    noBackdrop?: boolean,

    // do not set focus on modal element
    noFocus?: boolean,

    // allow parent element scrolling
    allowScroll?: boolean,

    // issue "onCloseRequest" on document clicks
    withDocumentClicks?: boolean,

    // do not issue "onCloseRequest" on backdrop clicks
    noBackdropClicks?: boolean,

    // element class names
    classNameBody?: string,
    classNameBackdrop?: string,

    // animations prefixes
    classPrefixBody?: string,
    classPrefixBackdrop?: string,

    // when close requested by mouse or keyboard
    onCloseRequest?: () => any,

    // before open callback
    beforeOpen?: () => any,

    // before close callback
    beforeClose?: () => any,

    // open callback
    onOpen?: () => any,

    // close callback
    onClose?: () => any,
}

interface IState {
    stage: string,
}
