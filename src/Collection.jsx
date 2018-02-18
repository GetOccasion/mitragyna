import React from 'react';
import PropTypes from 'prop-types';
import ActiveResource from 'active-resource';
import _ from 'underscore';

export class Collection extends React.PureComponent {
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
