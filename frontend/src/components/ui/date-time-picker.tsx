import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import dayjs, { type Dayjs } from "dayjs";
import { useTheme } from "@/lib/theme-provider";

interface AppDateTimePickerProps {
  value?: string | null;
  onChange: (isoString: string) => void;
  label?: string;
  disabled?: boolean;
  minDateTime?: string;
  maxDateTime?: string;
  /** Set true when inside a Sheet/Dialog to prevent focus conflicts */
  insideOverlay?: boolean;
}

export function AppDateTimePicker({
  value,
  onChange,
  label,
  disabled,
  minDateTime,
  maxDateTime,
  insideOverlay = false,
}: AppDateTimePickerProps) {
  const { theme } = useTheme();

  const muiTheme = createTheme({
    palette: {
      mode: theme === "dark" ? "dark" : "light",
    },
    components: {
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: "6px",
            fontSize: "0.875rem",
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: "0.875rem",
          },
        },
      },
    },
  });

  return (
    <ThemeProvider theme={muiTheme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DateTimePicker
          label={label}
          value={value ? dayjs(value) : null}
          onChange={(val: Dayjs | null) => onChange(val ? val.toISOString() : "")}
          disabled={disabled}
          minDateTime={minDateTime ? dayjs(minDateTime) : undefined}
          maxDateTime={maxDateTime ? dayjs(maxDateTime) : undefined}
          slotProps={{
            textField: {
              size: "small",
              fullWidth: true,
              onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
            },
            popper: insideOverlay
              ? { disablePortal: true, style: { zIndex: 9999 } }
              : { style: { zIndex: 9999 } },
            dialog: insideOverlay ? { disablePortal: true } : undefined,
          }}
        />
      </LocalizationProvider>
    </ThemeProvider>
  );
}
