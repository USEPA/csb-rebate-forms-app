import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  className?: string;
  children: string;
  components?: Components;
};

// NOTE: This is just a wrapper around the <ReactMarkdown /> component to
// automatically use the GitHub Flavored Markdown (GFM) remark plugin to support
// GFM in the static content files, and set some default attributes for
// rendering anchor links consistently (and support allowing markdown authors
// to determine if an anchor link should open in a new tab – see note below).
// Any additional elements beyond anchor links can be passed when to explicitly
// set how those components should be rendered.
export function MarkdownContent({ className, children, components }: Props) {
  return (
    <ReactMarkdown
      className={className || ""}
      children={children}
      remarkPlugins={[remarkGfm]}
      components={{
        ...components,
        a: ({ node, ...props }) => {
          // NOTE: The only attribute GFM allows you to set on hyperlinks is
          // title attributes, so authors of the markdown content will need to
          // set the title attribute to "external" for any links that should
          // open in a new tab. For example:
          // [contact EPA](https://www.epa.gov/aboutepa/forms/contact-epa "external")
          //
          // If a different title attribute is set in the markdown (unlikely)
          // the code below will use the title set in the markdown as the
          // rendered anchor link's title attribute.
          const title = node?.properties?.title;
          const externalLink = title === "external";
          return (
            <a
              {...props}
              className="usa-link"
              title={title ? (externalLink ? "" : title.toString()) : ""}
              target={externalLink ? "_blank" : ""}
              rel={externalLink ? "noopener noreferrer" : ""}
            >
              {props.children}
            </a>
          );
        },
      }}
    />
  );
}
