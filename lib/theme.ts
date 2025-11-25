import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
import { mode } from '@chakra-ui/theme-tools';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  colors: {
    brand: {
      50: '#e3f2fd',
      100: '#bbdefb',
      200: '#90caf9',
      300: '#64b5f6',
      400: '#42a5f5',
      500: '#2196f3', // Primary brand color
      600: '#1e88e5',
      700: '#1976d2',
      800: '#1565c0',
      900: '#0d47a1',
    },
    milk: {
      50: '#fefefe',
      100: '#fdfdfd',
      200: '#fbfbfb',
      300: '#f9f9f9',
      400: '#f7f7f7',
      500: '#f5f5f5',
      600: '#eeeeee',
      700: '#e0e0e0',
      800: '#bdbdbd',
      900: '#9e9e9e',
    },
  },
  fonts: {
    heading: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`,
    body: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`,
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '3.75rem',
    '7xl': '4.5rem',
  },
  styles: {
    global: (props: any) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'black' : 'gray.50',
        color: props.colorMode === 'dark' ? 'gray.100' : 'gray.800',
      },
      '*::placeholder': {
        color: props.colorMode === 'dark' ? 'gray.500' : 'gray.400',
      },
      '*, *::before, *::after': {
        borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
      },
      // Override badge backgrounds in dark mode - force light grey for all badges
      ...(props.colorMode === 'dark' && {
        '[class*="chakra-badge"]:not([data-variant="outline"])': {
          bg: 'gray.600 !important',
          color: 'gray.200 !important',
        },
      }),
    }),
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
        borderRadius: 'lg',
        transition: 'all 0.2s',
        _hover: {
          transform: 'translateY(-2px)',
        },
        _active: {
          transform: 'translateY(0)',
        },
        _focus: {
          boxShadow: 'outline',
        },
      },
      sizes: {
        sm: {
          fontSize: 'sm',
          px: 4,
          py: 2,
        },
        md: {
          fontSize: 'md',
          px: 6,
          py: 3,
        },
        lg: {
          fontSize: 'lg',
          px: 8,
          py: 4,
        },
      },
      variants: {
        solid: {
          bg: 'cyan.500',
          color: 'white',
          _hover: {
            bg: 'cyan.600',
            transform: 'translateY(-2px)',
            boxShadow: 'lg',
          },
          _active: {
            bg: 'cyan.700',
            transform: 'translateY(0)',
          },
          transition: 'all 0.2s',
        },
        outline: {
          borderColor: 'cyan.500',
          color: 'cyan.500',
          _hover: {
            bg: 'cyan.50',
            transform: 'translateY(-2px)',
          },
          transition: 'all 0.2s',
        },
        ghost: {
          color: 'cyan.500',
          _hover: {
            bg: 'cyan.50',
          },
        },
      },
      defaultProps: {
        colorScheme: 'cyan',
      },
    },
    Card: {
      baseStyle: (props: any) => ({
        container: {
          borderRadius: 'xl',
          boxShadow: 'sm',
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
        },
      }),
      variants: {
        elevated: {
          container: {
            boxShadow: 'lg'
          },
        },
        outline: {
          container: {
            border: '1px solid',
            borderColor: 'gray.200',
            boxShadow: 'none',
          },
        },
        filled: {
          container: {
            bg: 'gray.50',
          },
        },
      },
    },
    Input: {
      baseStyle: (props: any) => ({
        field: {
          bg: mode('white', 'gray.700')(props),
          color: mode('gray.800', 'gray.100')(props),
        },
      }),
      variants: {
        outline: {
          field: {
            borderColor: mode('gray.300', 'gray.600')({}),
            _hover: {
              borderColor: mode('gray.400', 'gray.500')({}),
            },
            _focus: {
              borderColor: 'cyan.500',
              boxShadow: '0 0 0 1px var(--chakra-colors-cyan-500)',
            },
          },
        },
        filled: {
          field: {
            bg: mode('gray.50', 'gray.700')({}),
            _hover: {
              bg: mode('gray.100', 'gray.600')({}),
            },
            _focus: {
              bg: mode('white', 'gray.700')({}),
              borderColor: 'cyan.500',
            },
          },
        },
      },
      defaultProps: {
        focusBorderColor: 'cyan.500',
      },
    },
    Select: {
      variants: {
        outline: {
          field: {
            borderColor: 'gray.300',
            _hover: {
              borderColor: 'gray.400',
            },
            _focus: {
              borderColor: 'cyan.500',
              boxShadow: '0 0 0 1px var(--chakra-colors-cyan-500)',
            },
          },
        },
      },
      defaultProps: {
        focusBorderColor: 'cyan.500',
      },
    },
    Textarea: {
      baseStyle: (props: any) => ({
        bg: mode('white', 'gray.700')(props),
        color: mode('gray.800', 'gray.100')(props),
      }),
      variants: {
        outline: {
          borderColor: mode('gray.300', 'gray.600')({}),
          _hover: {
            borderColor: mode('gray.400', 'gray.500')({}),
          },
          _focus: {
            borderColor: 'cyan.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-cyan-500)',
          },
        },
        filled: {
          bg: mode('gray.50', 'gray.700')({}),
          _hover: {
            bg: mode('gray.100', 'gray.600')({}),
          },
          _focus: {
            bg: mode('white', 'gray.700')({}),
            borderColor: 'cyan.500',
          },
        },
      },
      defaultProps: {
        focusBorderColor: 'cyan.500',
      },
    },
    Badge: {
      baseStyle: (props: any) => ({
        textTransform: 'uppercase',
        fontWeight: 'bold',
        fontSize: 'xs',
        px: 2,
        py: 1,
        borderRadius: 'md',
      }),
      variants: {
        solid: (props: any) => ({
          bg: mode('cyan.500', 'gray.600')(props),
          color: mode('white', 'gray.200')(props),
        }),
        subtle: (props: any) => ({
          bg: mode('cyan.50', 'gray.600')(props),
          color: mode('cyan.700', 'gray.200')(props),
        }),
        outline: (props: any) => ({
          border: '1px solid',
          borderColor: mode('cyan.500', 'gray.400')(props),
          color: mode('cyan.500', 'gray.300')(props),
        }),
      },
    },
    Heading: {
      baseStyle: {
        fontWeight: 'bold',
        color: 'gray.800',
      },
    },
    Link: {
      baseStyle: {
        color: 'cyan.500',
        _hover: {
          textDecoration: 'underline',
          color: 'cyan.600',
        },
      },
    },
    Table: {
      variants: {
        simple: {
          th: {
            borderColor: 'gray.200',
            color: 'gray.600',
            fontWeight: 'semibold',
            textTransform: 'uppercase',
            fontSize: 'xs',
            letterSpacing: 'wider',
          },
          td: {
            borderColor: 'gray.200',
          },
        },
        striped: {
          tbody: {
            tr: {
              '&:nth-of-type(odd)': {
                bg: 'gray.50',
              },
            },
          },
        },
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          borderRadius: 'xl',
          boxShadow: '2xl',
        },
      },
    },
    Drawer: {
      baseStyle: {
        dialog: {
          bg: 'white',
        },
      },
    },
    Alert: {
      variants: {
        subtle: {
          container: {
            borderRadius: 'lg',
          },
        },
        'left-accent': {
          container: {
            borderRadius: 'lg',
            borderLeftWidth: '4px',
          },
        },
      },
    },
    Tabs: {
      variants: {
        line: {
          tab: {
            borderColor: 'transparent',
            _selected: {
              color: 'cyan.600',
              borderColor: 'cyan.600',
              borderBottomWidth: '2px',
            },
            _hover: {
              color: 'cyan.500',
            },
          },
        },
        enclosed: {
          tab: {
            _selected: {
              bg: 'white',
              borderColor: 'gray.200',
              borderBottomColor: 'white',
              color: 'cyan.600',
            },
          },
        },
      },
    },
    Stat: {
      baseStyle: {
        container: {
          padding: 4,
        },
        label: {
          color: 'gray.600',
          fontWeight: 'medium',
          fontSize: 'sm',
        },
        number: {
          color: 'gray.800',
          fontWeight: 'bold',
          fontSize: '2xl',
        },
        helpText: {
          color: 'gray.500',
          fontSize: 'xs',
        },
      },
    },
    Progress: {
      baseStyle: {
        track: {
          bg: 'gray.200',
        },
      },
      variants: {
        gradient: {
          filledTrack: {
            bgGradient: 'linear(to-r, cyan.400, cyan.600)',
          },
        },
      },
    },
  },
  shadows: {
    outline: '0 0 0 3px rgba(6, 182, 212, 0.6)',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  radii: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  space: {
    px: '1px',
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    32: '8rem',
    40: '10rem',
    48: '12rem',
    56: '14rem',
    64: '16rem',
  },
  breakpoints: {
    sm: '30em',
    md: '48em',
    lg: '62em',
    xl: '80em',
    '2xl': '96em',
  },
});

export default theme;