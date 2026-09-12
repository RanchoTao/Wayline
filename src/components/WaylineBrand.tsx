/** Shared vector artwork: geometric waymark, skyline and a continuous flight path. */
export function Waymark() {
  return (
    <svg viewBox="0 0 800 800" fill="currentColor" aria-hidden="true">
      <path d="m315 120 83 81-83 85 110 114-110 114 77 80-82 80-162-158 109-116-109-114Z" />
      <path d="m459 205 194 195-194 196-83-82 109-114-109-114Z" />
    </svg>
  );
}

export function FlightScene({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 760 290" fill="none" aria-hidden="true">
      <path d="M0 240 90 210 148 230 242 196 322 224 412 188 520 223 618 190 760 222V290H0Z" fill="#eaf4f7" />
      <path d="m0 260 120-30 100 20 130-21 116 34 110-37 184 26v38H0Z" fill="#d5eaf0" />
      <g fill="#a6cfde">
        <path d="M190 262v-37h20v37m25 0v-60h25v60m38 0v-84h28v84m35 0v-49h21v49m44 0V149h31v113m44 0v-67h23v67m51 0V120l30 11v131m30 0v-79h27v79m43 0v-38h24v38" />
      </g>
      <g fill="#5799b5">
        <path d="M268 264v-42h25v42m48 0v-67h26v67m42 0v-38h29v38m32 0V167h28v97m41 0v-46h24v46m35 0v-63h26v63m53 0v-29h27v29" />
      </g>
      <path d="M0 267h760M90 278h165m180 0h234" stroke="#93becf" strokeWidth="2" />
      <path d="M543 230C427 219 366 71 252 106S153 226 322 174 553 94 658 29" stroke="#2e7092" strokeWidth="2.5" strokeLinecap="round" />
      <g fill="white" stroke="#2e7092" strokeWidth="1.5">
        <circle cx="253" cy="106" r="4" /><circle cx="201" cy="157" r="4" /><circle cx="322" cy="174" r="4" /><circle cx="466" cy="124" r="4" /><circle cx="573" cy="77" r="4" />
      </g>
      <path d="m625 30 63-24-25 63-10-26Z" fill="#287699" />
      <path d="m625 30 63-24-35 37Z" fill="#67aec7" />
      <path d="m653 43 35-37-29 44 4 19Z" fill="#1f5777" />
    </svg>
  );
}
