import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


def get_relative_xpath(element):
    """
    Generate a relative XPath for the given element.
    """
    print("Inside Get Relative Path")
    tag_name = element.tag_name

    # Use ID if available (unique identifier)
    id_attr = element.get_attribute("id")
    if id_attr:
        return f"//{tag_name}[@id='{id_attr}']"

    # Use name if available (common for form elements)
    name_attr = element.get_attribute("name")
    if name_attr:
        return f"//{tag_name}[@name='{name_attr}']"

    # Use class if available (but only if it's unique)
    class_attr = element.get_attribute("class")
    if class_attr:
        # Check if the class is unique
        siblings = element.find_elements(By.XPATH, f"//{tag_name}[@class='{class_attr}']")
        if len(siblings) == 1:
            return f"//{tag_name}[@class='{class_attr}']"

    # Use other attributes (e.g., type, value, etc.)
    attributes = element.get_property("attributes")
    conditions = []
    for attr in attributes:
        if attr["name"] not in ["id", "class", "style", "hidden"]:
            conditions.append(f"@{attr['name']}='{attr['value']}'")

    # If the element is the <html> tag, return its XPath
    if element.tag_name.lower() == "html":
        return "//html"

    # If no unique attributes, use position in the DOM
    if not conditions:
        try:
            parent = element.find_element(By.XPATH, "..")
            siblings = parent.find_elements(By.XPATH, f"./{tag_name}")
            if len(siblings) > 1:
                index = siblings.index(element) + 1
                return f"{get_relative_xpath(parent)}/{tag_name}[{index}]"
        except Exception as e:
            print(f"Error while finding parent: {e}")
            return f"//{tag_name}"

    condition_str = " and ".join(conditions)
    return f"//{tag_name}[{condition_str}]" if conditions else f"//{tag_name}"

    # """
    # Generate a relative XPath for the given element.
    # """
    # print("Inside Get Relative Path")
    # tag_name = element.tag_name

    # # Use ID if available (unique identifier)
    # id_attr = element.get_attribute("id")
    # if id_attr:
    #     return f"//{tag_name}[@id='{id_attr}']"

    # # Use name if available (common for form elements)
    # name_attr = element.get_attribute("name")
    # if name_attr:
    #     return f"//{tag_name}[@name='{name_attr}']"

    # # Use class if available (but only if it's unique)
    # class_attr = element.get_attribute("class")
    # if class_attr:
    #     # Check if the class is unique
    #     siblings = element.find_elements(By.XPATH, f"//{tag_name}[@class='{class_attr}']")
    #     if len(siblings) == 1:
    #         return f"//{tag_name}[@class='{class_attr}']"

    # # Use other attributes (e.g., type, value, etc.)
    # attributes = element.get_property("attributes")
    # conditions = []
    # for attr in attributes:
    #     if attr["name"] not in ["id", "class", "style", "hidden"]:
    #         conditions.append(f"@{attr['name']}='{attr['value']}'")

    # # If no unique attributes, use position in the DOM
    # if not conditions:
    #     parent = element.find_element(By.XPATH, "..")
    #     siblings = parent.find_elements(By.XPATH, f"./{tag_name}")
    #     if len(siblings) > 1:
    #         index = siblings.index(element) + 1
    #         return f"{get_relative_xpath(parent)}/{tag_name}[{index}]"

    # condition_str = " and ".join(conditions)
    # return f"//{tag_name}[{condition_str}]" if conditions else f"//{tag_name}"


class ExtractDataView(APIView):
    def post(self, request):
        print("Inside views1.py")
        html_content = request.data.get("html")

        if not html_content:
            return Response({"error": "No HTML received"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Step 1: Set up Selenium WebDriver
            options = webdriver.ChromeOptions()
            # options.add_argument("--headless")  # Disable headless mode for debugging
            try:
                driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
            except Exception as e:
                print(f"Selenium setup error: {e}")
                return Response({"error": "Selenium setup failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Step 2: Load the HTML content into Selenium
            print("Loading HTML content into Selenium...")
            driver.get("data:text/html;charset=utf-8," + html_content)

            # Debugging: Log raw page source
            print("Page source after loading:")
            print(driver.page_source)

            # Step 3: Wait for content to load
            try:
                WebDriverWait(driver, 50).until(
                    EC.presence_of_element_located((By.XPATH, "//body/*"))  # Wait for any element inside the body
                )
                print("Body content loaded successfully.")
            except Exception as e:
                print(f"Timeout waiting for content: {e}")
                return Response({"error": "Timeout waiting for content"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Step 4: Extract information for all elements
            elements = driver.find_elements(By.XPATH, "//*")
            print(f"Number of elements found: {len(elements)}")

            data = []
            for elem in elements:
                try:
                    if elem.is_displayed():  # Process only visible elements
                        relative_xpath = get_relative_xpath(elem)
                        x = elem.location.get("x", None)
                        y = elem.location.get("y", None)
                        width = elem.size.get("width", None)
                        height = elem.size.get("height", None)
                        bg_color = elem.value_of_css_property("background-color") or "N/A"
                        font_size = elem.value_of_css_property("font-size") or "N/A"
                        font_style = elem.value_of_css_property("font-style") or "N/A"
                        font_color = elem.value_of_css_property("color") or "N/A"
                        text = elem.text.strip()

                        data.append({
                            "Relative XPath": relative_xpath,
                            "x": x,
                            "y": y,
                            "width": width,
                            "height": height,
                            "background-color": bg_color,
                            "font-size": font_size,
                            "font-style": font_style,
                            "font-color": font_color,
                            "text": text,
                        })
                except Exception as e:
                    print(f"Error processing element: {e}")

            # Save data to a DataFrame
            if data:
                df = pd.DataFrame(data)
                print(df)
                df.to_csv("extracted_elements.csv", index=False)
                print("Data saved to extracted_elements.csv")
            else:
                print("No data to save.")

            # Quit the driver
            driver.quit()

            return Response({"message": "Elements extracted successfully", "rows": len(df)}, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            print(f"Unexpected error: {e}")
            print(traceback.format_exc())
            return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# class ExtractDataView(APIView):
    def post(self, request):
        print("Inside views1.py")
        html_content = request.data.get("html")

        if not html_content:
            return Response({"error": "No HTML received"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Step 1: Set up Selenium WebDriver
            options = webdriver.ChromeOptions()
            options.add_argument("--headless")  
            options.add_argument("--enable-javascript")

            try:
                driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
            except Exception as e:
                print(f"Selenium setup error: {e}")
                return Response({"error": "Selenium setup failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Step 2: Load the HTML content into Selenium
            print("Loading HTML content into Selenium...")
            driver.get("data:text/html;charset=utf-8," + html_content)
            html_output_path = "html_content.txt"
            with open(html_output_path, "w", encoding="utf-8") as f:
                f.write(driver.page_source)

            print(f"HTML content saved to {html_output_path}")

            # Step 3: Wait for content to load (if applicable)
            try:
                WebDriverWait(driver, 50).until(EC.presence_of_element_located((By.XPATH, "//*")))
            except Exception as e:
                print(f"Timeout waiting for content: {e}")

            print("Body content loaded:")
            print(driver.execute_script("return document.body.outerHTML;"))


            # Step 4: Extract information for all elements
            elements = driver.find_elements(By.XPATH, "//*")
            print(f"Number of elements found: {len(elements)}")

            data = []
            for elem in elements:
                try:
                    if elem.is_displayed():  # Process only visible elements
                        relative_xpath = get_relative_xpath(elem)
                        x = elem.location.get("x", None)
                        y = elem.location.get("y", None)
                        width = elem.size.get("width", None)
                        height = elem.size.get("height", None)
                        bg_color = elem.value_of_css_property("background-color") or "N/A"
                        font_size = elem.value_of_css_property("font-size") or "N/A"
                        font_style = elem.value_of_css_property("font-style") or "N/A"
                        font_color = elem.value_of_css_property("color") or "N/A"
                        text = elem.text.strip()

                        data.append({
                            "Relative XPath": relative_xpath,
                            "x": x,
                            "y": y,
                            "width": width,
                            "height": height,
                            "background-color": bg_color,
                            "font-size": font_size,
                            "font-style": font_style,
                            "font-color": font_color,
                            "text": text,
                        })
                except Exception as e:
                    print(f"Error processing element: {e}")

            # Save data to a DataFrame
            if data:
                df = pd.DataFrame(data)
                print(df)
                df.to_csv("extracted_elements.csv", index=False)
                print("Data saved to extracted_elements.csv")
            else:
                print("No data to save.")

            # Quit the driver
            driver.quit()

            return Response({"message": "Elements extracted successfully", "rows": len(df)}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

