import React from 'react';
import PropTypes from 'prop-types';
import ActiveResource from 'active-resource';
import _ from 'underscore';

Mitragyna.Collection = class Collection extends React.PureComponent {
  static propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.node,
    ]),
    className: PropTypes.string,
    blankComponent: PropTypes.func,
    component: PropTypes.func,
    inlineRows: PropTypes.bool,
    rowClassName: PropTypes.string,
    subject: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.func,
    ]).isRequired,
  };

  static defaultProps = {
    inlineRows: false
  };

  // link to global state by enabling afterLoad, afterAdd, afterRemove, afterUpdate callbacks that can call
  // an action linked to dispatch

  constructor() {
    super();

    this.state = {
      loading: true,
      target: Immutable.List()
    };

    _.bindAll(this,
      'buildOnTarget',
      'replaceOnTarget',
      'removeFromTarget',
    );
  }

  componentDidMount() {
    this.setTarget(this.props);
  }

  componentWillReceiveProps(nextProps) {
    this.setTarget(nextProps);
  }

  setTarget(props) {
    const { subject } = props;

    let isRelationship = subject.isA(ActiveResource.prototype.Associations.prototype.CollectionProxy);

    let setLoadedTarget = (target) => this.setState({ loading: false, target: Immutable.List(target.toArray()) });

    if(isRelationship) {
      if(subject.base.loaded()) {
        setLoadedTarget(subject.base.target)
      } else {
        subject.load()
        .then(setLoadedTarget)
      }
    } else if(!_.isUndefined(subject.all)) {
      subject.all()
      .then(setLoadedTarget)
    }
  }

  buildOnTarget(attributes) {
    const { subject } = this.props;
    const { target } = this.state;

    this.setState({ target: target.push(subject.build(attributes)) });
  }

  replaceOnTarget(newItem, oldItem) {
    let index = this.state.target.findIndex((i) => i == oldItem);
    return this.setState({ target: this.state.target.set(index, newItem) });
  }

  removeFromTarget(item) {
    let index = this.state.target.findIndex((i) => i.localId == item.localId);
    return this.setState({ target: this.state.target.delete(index) });
  }

  render() {
    const { blankComponent, children, className, component, inlineRows, rowClassName } = this.props;
    const { loading, target } = this.state;

    return (
      <section className={ className }>
        { loading ? (
          <span>Loading</span>
        ) : (
          target.size > 0 ? (
            target.map((t) =>
              <Mitragyna.Resource subject={ t } key={ t.localId } component= { component }
                        className={ rowClassName } inline={ inlineRows }
                        afterUpdate={ this.replaceOnTarget }>
                { children }
              </Mitragyna.Resource>
            )
          ) : (blankComponent != null &&
            blankComponent()
          )
        )}
      </section>
    );
  }
}

Mitragyna.ErrorsFor = class ErrorsFor extends React.PureComponent {
  static propTypes = {
    attribute: PropTypes.string,
    resource: PropTypes.object.isRequired,
  };

  render() {
    const { attribute, resource } = this.props;

    if(_.size(resource.errors().forField(attribute)) < 1) {
      return null;
    }

    return(
      <p className='dark-red f6 mt2 mb0'>
        {
          _.map(resource.errors().forField(attribute),
            (message, code) => <span key={ code } className='db'>{ message }</span>
          )
        }
      </p>
    );
  }
};

Mitragyna.Input = class Input extends React.PureComponent {
  static contextTypes = {
    afterUpdate: PropTypes.func,
    inline: PropTypes.bool,
    resource: PropTypes.object,
  };

  static propTypes = {
    includeBlank: PropTypes.bool,
    options: PropTypes.array,
    optionsLabelKey: PropTypes.string,
  };

  constructor() {
    super();

    _.bindAll(this,
      'createInputElement',
      'createSelectElement',
      'handleChange',
      'handleUpdate',
    );
  }

  componentWillMount() {
    const { name, type } = this.props;
    const { resource } = this.context;

    // Set initial value to that of the resources
    this.setState({
      value: type == 'select' ? this.selectValueFor(resource[name]()) : resource[name]
    });
  }

  render() {
    const { name, type } = this.props;
    const { inline, resource } = this.context;

    let input = (type === 'select') ? this.createSelectElement() : this.createInputElement();

    return React.createElement(inline ? 'span' : 'div', {}, [
      input, <Mitragyna.ErrorsFor attribute={ name } resource={ resource } key='errors' />
    ]);
  }

  createInputElement() {
    const { name } = this.props;

    return React.createElement('input', {
      ...this.props,
      key: name,
      onBlur: this.handleUpdate,
      onChange: this.handleChange,
      value: this.state.value,
    });
  }

  // TODO: Add support for non-resource options
  selectValueFor(resource) {
    return resource && resource.id || '';
  }

  createSelectElement() {
    const { includeBlank, name, options, optionsLabelKey } = this.props;

    let selectOptions = null;
    if (options.isEmpty()) {
      throw 'Input type="select" must have options';
    } else {
      selectOptions = options.map((o) => <option key={o.localId} value={o.id}>{o[optionsLabelKey]}</option>);
      if (includeBlank) {
        selectOptions = selectOptions.unshift(<option key={-1} value=''></option>);
      }
    }

    let selectProps = _.omit(this.props, _.keys(Input.propTypes));

    return React.createElement('select', {
      ...selectProps,
      key: name,
      onBlur: this.handleUpdate,
      onChange: this.handleChange,
      value: this.state.value,
    }, selectOptions);
  }

  handleChange(e) {
    e.persist();

    this.setState({
      value: e.target.value
    });
  }

  handleUpdate(e) {
    e.persist();

    const { afterUpdate, resource } = this.context;
    const { name, type, options } = this.props;

    var value = e.target.value;

    if(type === 'select') {
      value = options.find((o) => o.id === value);
    }

    afterUpdate(resource.assignAttributes({ [name]: value }));
  }
}

Mitragyna.Resource = class Resource extends React.PureComponent {
  static propTypes = {
    afterUpdate: PropTypes.func,
    children: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.node,
    ]),
    className: PropTypes.string,
    component: PropTypes.func,
    inline: PropTypes.bool,
    reflection: PropTypes.string,
    subject: PropTypes.object.isRequired,
  };

  static contextTypes = {
    isNestedResource: PropTypes.bool,
    resourceRoot: PropTypes.object,
    updateRoot: PropTypes.func,
  };

  static childContextTypes = {
    afterUpdate: PropTypes.func,
    inline: PropTypes.bool,
    isNestedResource: PropTypes.bool,
    resource: PropTypes.object,
    root: PropTypes.object,
    updateRoot: PropTypes.func,
  };

  static defaultProps = {
    inline: false
  };

  constructor(props, context) {
    super();

    _.bindAll(this,
      'afterUpdate',
      'updateRoot'
    );
  }

  componentWillMount() {
    const { root } = this.context;
    const { reflection, subject } = this.props;

    if(reflection) {
      var reflectionInstance = root.reflectOnAssociation(reflection);
      if(_.isUndefined(reflectionInstance)) throw 'Reflection ' + reflection + ' not found.';
      var inverseReflection = reflectionInstance.inverseOf();
      if(_.isUndefined(inverseReflection)) throw 'Reflection ' + reflection + ' must have inverse.';

      this.setState({
        inverseReflection,
        reflection: reflectionInstance,
      });
    } else {
      this.setState({ resource: subject });
    }
  }

  componentWillReceiveProps(nextProps) {
    this.setState({ resource: nextProps.subject });
  }

  afterUpdate(newResource) {
    const { updateRoot } = this.context;
    const { inverseReflection } = this.state;

    if(inverseReflection) {
      updateRoot(newResource.association(inverseReflection.name).target);
    } else {
      this.updateRoot(newResource);
    }
  }

  getChildContext() {
    const { root } = this.context;
    const { inline } = this.props;
    const { resource } = this.state;

    let childContext = {
      afterUpdate: this.afterUpdate,
      inline,
      isNestedResource: true,
      root: root || this,
      resource,
      updateRoot: this.updateRoot
    };

    return childContext;
  }

  render() {
    const { isNestedResource } = this.context;
    const { children, className, component } = this.props;
    const { resource } = this.state;

    let body = null;
    if(component) {
      body = React.createElement(component, { subject: resource });
    } else {
      body = children;
    }

    if(!isNestedResource) {
      body = <form>{ body }</form>;
    }

    return (
      <section className={ className }>
        { body }
      </section>
    );
  }

  updateRoot(newRoot, fromSave = false) {
    const { afterUpdate } = this.context;
    const { resource } = this.props;

    this.setState({ resource: newRoot });

    if(!_.isUndefined(afterUpdate)) afterUpdate(newRoot, resource);

    if(!fromSave) {
      newRoot.save((root) => this.updateRoot(root, true));
    }
  }
}