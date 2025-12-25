import React from "react";

function _extends() {
  _extends =
    Object.assign ||
    function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    };
  return _extends.apply(this, arguments);
}

function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};
  var target = _objectWithoutPropertiesLoose(source, excluded);
  var key, i;
  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }
  return target;
}

function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;
  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }
  return target;
}

var _ref2 = /*#__PURE__*/ React.createElement(
  "defs",
  null,
  /*#__PURE__*/ React.createElement(
    "linearGradient",
    {
      id: "ab-slider-handle-bg-a",
      x1: "50%",
      x2: "50%",
      y1: "0%",
      y2: "99.182%",
    },
    /*#__PURE__*/ React.createElement("stop", {
      offset: "0%",
      stopColor: "#1E1E1E",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "100%",
      stopColor: "#0B0B0B",
    })
  ),
  /*#__PURE__*/ React.createElement(
    "linearGradient",
    {
      id: "ab-slider-handle-bg-b",
      x1: "50%",
      x2: "50%",
      y1: "0%",
      y2: "100%",
    },
    /*#__PURE__*/ React.createElement("stop", {
      offset: "0%",
      stopColor: "#1C1C1C",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "100%",
      stopColor: "#1E1E1E",
    })
  ),
  /*#__PURE__*/ React.createElement(
    "linearGradient",
    {
      id: "ab-slider-handle-bg-c",
      x1: "50%",
      x2: "50%",
      y1: "0%",
      y2: "100%",
    },
    /*#__PURE__*/ React.createElement("stop", {
      offset: "0%",
      stopColor: "#191919",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "61.836%",
      stopColor: "#282828",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "77.209%",
      stopColor: "#1C1C1C",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "100%",
      stopColor: "#1C1C1C",
    })
  ),
  /*#__PURE__*/ React.createElement(
    "linearGradient",
    {
      id: "ab-slider-handle-bg-d",
      x1: "50%",
      x2: "50%",
      y1: "0%",
      y2: "100%",
    },
    /*#__PURE__*/ React.createElement("stop", {
      offset: "0%",
      stopColor: "#2E2E2E",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "100%",
      stopColor: "#646464",
    })
  ),
  /*#__PURE__*/ React.createElement(
    "linearGradient",
    {
      id: "ab-slider-handle-bg-e",
      x1: "50%",
      x2: "50%",
      y1: "0%",
      y2: "100%",
    },
    /*#__PURE__*/ React.createElement("stop", {
      offset: "0%",
      stopColor: "#121212",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "100%",
      stopColor: "#222",
    })
  ),
  /*#__PURE__*/ React.createElement(
    "linearGradient",
    {
      id: "ab-slider-handle-bg-f",
      x1: "50%",
      x2: "50%",
      y1: "31.152%",
      y2: "70.215%",
    },
    /*#__PURE__*/ React.createElement("stop", {
      offset: "0%",
      stopColor: "#C1C1C1",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "100%",
      stopColor: "#898989",
    })
  ),
  /*#__PURE__*/ React.createElement(
    "linearGradient",
    {
      id: "ab-slider-handle-bg-g",
      x1: "50%",
      x2: "50%",
      y1: "0%",
      y2: "100%",
    },
    /*#__PURE__*/ React.createElement("stop", {
      offset: "0%",
      stopColor: "#111",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "93.688%",
      stopColor: "#2A2A2A",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "93.765%",
      stopColor: "#292929",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "100%",
      stopColor: "#151515",
    })
  ),
  /*#__PURE__*/ React.createElement(
    "linearGradient",
    {
      id: "ab-slider-handle-bg-h",
      x1: "50%",
      x2: "50%",
      y1: "0%",
      y2: "100%",
    },
    /*#__PURE__*/ React.createElement("stop", {
      offset: "0%",
      stopColor: "#111",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "93.688%",
      stopColor: "#2A2A2A",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "93.765%",
      stopColor: "#292929",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "100%",
      stopColor: "#151515",
    })
  ),
  /*#__PURE__*/ React.createElement(
    "linearGradient",
    {
      id: "ab-slider-handle-bg-i",
      x1: "50%",
      x2: "50%",
      y1: "0%",
      y2: "99.736%",
    },
    /*#__PURE__*/ React.createElement("stop", {
      offset: "0%",
      stopColor: "#3D3D3D",
    }),
    /*#__PURE__*/ React.createElement("stop", {
      offset: "100%",
      stopColor: "#4E4E4E",
    })
  )
);

var _ref3 = /*#__PURE__*/ React.createElement(
  "g",
  {
    fill: "none",
    fillRule: "evenodd",
  },
  /*#__PURE__*/ React.createElement("polygon", {
    fill: "url(#ab-slider-handle-bg-a)",
    points: "1 48 24 48 24 53 1 53",
  }),
  /*#__PURE__*/ React.createElement("polygon", {
    fill: "url(#ab-slider-handle-bg-b)",
    points: "2 5 23 5 23 8 2 8",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "url(#ab-slider-handle-bg-c)",
    strokeLinecap: "square",
    d: "M.5.5L.5 4.5M24.5.5L24.5 4.5",
  }),
  /*#__PURE__*/ React.createElement("polygon", {
    fill: "url(#ab-slider-handle-bg-d)",
    points: "2 8 23 8 23 47 2 47",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "url(#ab-slider-handle-bg-e)",
    strokeLinecap: "square",
    d: "M24.5 5.5L24.5 47.5M.5 5.5L.5 47.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    fill: "url(#ab-slider-handle-bg-f)",
    stroke: "#1B1B1B",
    strokeWidth: 2,
    d: "M2,24 L2,29 L23,29 L23,24 L2,24 Z",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#1E1E1E",
    strokeLinecap: "square",
    d: "M2.525,9.5 L22.475,9.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#262626",
    strokeLinecap: "square",
    d: "M2.525,31.5 L22.475,31.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#222",
    strokeLinecap: "square",
    d: "M2.525,11.5 L22.475,11.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#262626",
    strokeLinecap: "square",
    d: "M2.525 33.5L22.475 33.5M2.525 13.5L22.475 13.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#2C2C2C",
    strokeLinecap: "square",
    d: "M2.525,35.5 L22.475,35.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#292929",
    strokeLinecap: "square",
    d: "M2.525,15.5 L22.475,15.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#323232",
    strokeLinecap: "square",
    d: "M2.525,37.5 L22.475,37.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "url(#ab-slider-handle-bg-g)",
    strokeLinecap: "square",
    d: "M1.5,5.5 L1.5,22.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "url(#ab-slider-handle-bg-h)",
    strokeLinecap: "square",
    d: "M1.5,48 L1.5,31 L1.5,48 Z",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "url(#ab-slider-handle-bg-g)",
    strokeLinecap: "square",
    d: "M23.5,5.5 L23.5,22.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "url(#ab-slider-handle-bg-h)",
    strokeLinecap: "square",
    d: "M23.5,48 L23.5,31 L23.5,48 Z",
  }),
  /*#__PURE__*/ React.createElement("polygon", {
    fill: "url(#ab-slider-handle-bg-i)",
    points: "1 0 24 0 24 4 1 4",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#6A6A6A",
    strokeLinecap: "square",
    d: "M1.52272727,4.5 L23.4772727,4.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#2D2D2D",
    strokeLinecap: "square",
    d: "M2.525,17.5 L22.475,17.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#393939",
    strokeLinecap: "square",
    d: "M2.525,39.5 L22.475,39.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#313131",
    strokeLinecap: "square",
    d: "M2.525,19.5 L22.475,19.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#3E3E3E",
    strokeLinecap: "square",
    d: "M2.525,41.5 L22.475,41.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#343434",
    strokeLinecap: "square",
    d: "M2.525,21.5 L22.475,21.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#444",
    strokeLinecap: "square",
    d: "M2.525,43.5 L22.475,43.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#4B4B4B",
    strokeLinecap: "square",
    d: "M2.525,45.5 L22.475,45.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#4D4D4D",
    strokeLinecap: "square",
    d: "M2.525,46.5 L22.475,46.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#2B2A2B",
    strokeLinecap: "square",
    d: "M2.525,22.5 L22.475,22.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#181818",
    strokeLinecap: "square",
    d: "M.5 53L.5 48.5M24.5 53L24.5 48.5",
  }),
  /*#__PURE__*/ React.createElement("path", {
    stroke: "#646464",
    strokeLinecap: "square",
    d: "M2.525,47.5 L22.475,47.5",
  })
);

var SvgAbSliderHandleBg = function SvgAbSliderHandleBg(_ref) {
  var svgRef = _ref.svgRef,
    title = _ref.title,
    props = _objectWithoutProperties(_ref, ["svgRef", "title"]);

  return /*#__PURE__*/ React.createElement(
    "svg",
    _extends(
      {
        width: 25,
        height: 54,
        viewBox: "0 0 25 54",
        ref: svgRef,
      },
      props
    ),
    title ? /*#__PURE__*/ React.createElement("title", null, title) : null,
    _ref2,
    _ref3
  );
};

var ABSliderHandleBg = React.forwardRef(function (props, ref) {
  return /*#__PURE__*/ React.createElement(
    SvgAbSliderHandleBg,
    _extends(
      {
        svgRef: ref,
      },
      props
    )
  );
});

export default ABSliderHandleBg;
