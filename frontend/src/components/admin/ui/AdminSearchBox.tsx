import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

export default function AdminSearchBox({
  value,
  onChange,
  placeholder,
}: Props) {
  return (
    <label className="admin-search">
      <Search size={15} />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
